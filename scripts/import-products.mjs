import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import admin from "firebase-admin";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function slugifyId(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s_-]/gi, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  // Preferred: GOOGLE_APPLICATION_CREDENTIALS points to a service account JSON file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return;
  }

  // Alternative: raw JSON in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      projectId: projectId || svc.project_id,
    });
    return;
  }

  throw new Error(
    "Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account json file OR FIREBASE_SERVICE_ACCOUNT_JSON to the json contents."
  );
}

function readSeedFile() {
  const seedPath = process.env.SEED_FILE || path.resolve(process.cwd(), "seed", "products.seed.json");
  const raw = fs.readFileSync(seedPath, "utf8");
  const json = JSON.parse(raw);
  if (!json?.categories || !json?.products) {
    throw new Error(`Invalid seed file: ${seedPath}. Expected { categories: [], products: [] }`);
  }
  return { seedPath, json };
}

async function upsertCategories(db, categories) {
  const batch = db.batch();
  let ops = 0;

  for (const c of categories) {
    const id = String(c.id);
    if (!id) continue;
    const ref = db.collection("product_categories").doc(id);
    batch.set(
      ref,
      {
        name: c.name ?? "",
        icon: c.icon ?? null,
        sort_order: Number(c.sort_order ?? 0),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    ops++;

    // Firestore batch limit is 500
    if (ops >= 450) {
      await batch.commit();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

async function upsertProducts(db, products) {
  let batch = db.batch();
  let ops = 0;

  for (const p of products) {
    const name = String(p.name ?? "").trim();
    if (!name) continue;

    const productId = p.id ? String(p.id) : slugifyId(`${p.category_id ?? ""}_${name}`);
    const ref = db.collection("products").doc(productId);

    batch.set(
      ref,
      {
        name,
        category_id: p.category_id ?? null,
        calories_per_100g: Number(p.calories_per_100g ?? 0),
        protein_per_100g: Number(p.protein_per_100g ?? 0),
        fat_per_100g: Number(p.fat_per_100g ?? 0),
        carbs_per_100g: Number(p.carbs_per_100g ?? 0),
        is_approved: true,
        approved_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        source: p.source ?? "seed",
      },
      { merge: true }
    );
    ops++;

    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

async function main() {
  initAdmin();

  const { seedPath, json } = readSeedFile();
  const db = admin.firestore();

  console.log(`Seed file: ${seedPath}`);
  console.log(`Categories: ${json.categories.length}`);
  console.log(`Products: ${json.products.length}`);

  const metaRef = db.collection("meta").doc("seed");
  await metaRef.set(
    {
      products_seed_version: json.version ?? 1,
      products_seed_file: path.basename(seedPath),
      products_seed_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await upsertCategories(db, json.categories);
  await upsertProducts(db, json.products);

  console.log("Import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
