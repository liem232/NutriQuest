import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return;
  }

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
  const seedPath = process.env.SEED_FILE || path.resolve(process.cwd(), "seed", "achievements.seed.json");
  const raw = fs.readFileSync(seedPath, "utf8");
  const json = JSON.parse(raw);
  if (!json?.achievements) {
    throw new Error(`Invalid seed file: ${seedPath}. Expected { achievements: [] }`);
  }
  return { seedPath, json };
}

async function upsertAchievements(db, achievements) {
  let batch = db.batch();
  let ops = 0;

  for (const a of achievements) {
    const id = String(a.id ?? "").trim();
    if (!id) continue;

    const ref = db.collection("achievements").doc(id);
    batch.set(
      ref,
      {
        name: a.name ?? "",
        description: a.description ?? "",
        icon: a.icon ?? "🏆",
        condition_type: a.condition_type ?? "total_days",
        condition_value: Number(a.condition_value ?? 1),
        xp_reward: Number(a.xp_reward ?? 0),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
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
  console.log(`Achievements: ${json.achievements.length}`);

  const metaRef = db.collection("meta").doc("seed");
  await metaRef.set(
    {
      achievements_seed_version: json.version ?? 1,
      achievements_seed_file: path.basename(seedPath),
      achievements_seed_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await upsertAchievements(db, json.achievements);

  console.log("Import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
