import admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

if (!admin.apps.length) {
  admin.initializeApp();
}

function requireAuth(request: { auth?: { uid: string; token?: any } | null }) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return request.auth;
}

async function ensureNotBlocked(uid: string) {
  try {
    const snap = await admin.firestore().collection("profiles").doc(uid).get();
    if (snap.exists && (snap.data() as any)?.is_blocked) {
      throw new HttpsError("permission-denied", "User is blocked");
    }
  } catch (e: any) {
    if (e instanceof HttpsError) throw e;
    // If profiles read fails, be safe and deny.
    throw new HttpsError("permission-denied", "Access denied");
  }
}

function requireAdmin(request: { auth?: { uid: string; token?: any } | null }) {
  const auth = requireAuth(request);
  if (!auth.token?.admin) {
    throw new HttpsError("permission-denied", "Admin privileges required");
  }
  return auth;
}

async function deleteByQuery(q: FirebaseFirestore.Query) {
  while (true) {
    const snap = await q.limit(500).get();
    if (snap.empty) return;
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export const adminApproveProduct = onCall(async (request) => {
  requireAdmin(request);

  const productId = String((request.data as any)?.productId ?? "").trim();
  const approve = Boolean((request.data as any)?.approve ?? true);
  if (!productId) throw new HttpsError("invalid-argument", "productId is required");

  const ref = admin.firestore().collection("products").doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Product not found");

  await ref.set(
    {
      is_approved: approve,
      approved_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

export const submitProductForModeration = onCall(async (request) => {
  const auth = requireAuth(request);
  const uid = auth.uid;
  await ensureNotBlocked(uid);

  const data: any = request.data ?? {};
  const name = String(data?.name ?? "").trim();
  const calories = Number(data?.calories_per_100g);
  const protein = Number(data?.protein_per_100g ?? 0);
  const fat = Number(data?.fat_per_100g ?? 0);
  const carbs = Number(data?.carbs_per_100g ?? 0);
  const categoryIdRaw = data?.category_id;
  const category_id = categoryIdRaw === null || categoryIdRaw === undefined || categoryIdRaw === "" ? null : String(categoryIdRaw);

  if (!name) throw new HttpsError("invalid-argument", "name is required");
  if (!Number.isFinite(calories) || calories <= 0) throw new HttpsError("invalid-argument", "calories_per_100g must be > 0");
  if (![protein, fat, carbs].every((v) => Number.isFinite(v) && v >= 0)) {
    throw new HttpsError("invalid-argument", "macros must be >= 0");
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const limitRef = admin.firestore().collection("rate_limits").doc(`${uid}_product_${dayKey}`);
  const productsRef = admin.firestore().collection("products");

  const created = await admin.firestore().runTransaction(async (tx) => {
    const limitSnap = await tx.get(limitRef);
    const count = Number((limitSnap.exists ? (limitSnap.data() as any)?.count : 0) ?? 0) || 0;
    if (count >= 3) {
      throw new HttpsError("resource-exhausted", "Daily product submission limit reached");
    }

    const productDoc = productsRef.doc();
    tx.set(productDoc, {
      name,
      calories_per_100g: calories,
      protein_per_100g: protein,
      fat_per_100g: fat,
      carbs_per_100g: carbs,
      category_id,
      added_by: uid,
      is_approved: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(
      limitRef,
      {
        user_id: uid,
        type: "product_daily",
        day: dayKey,
        count: count + 1,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { id: productDoc.id };
  });

  return { ok: true, id: created.id };
});

export const addDiaryEntry = onCall(async (request) => {
  const auth = requireAuth(request);
  const uid = auth.uid;
  await ensureNotBlocked(uid);

  const data: any = request.data ?? {};
  const product_id = String(data?.product_id ?? "").trim();
  const meal = String(data?.meal ?? "").trim();
  const grams = Number(data?.grams);
  const date = String(data?.date ?? "").trim();
  const product = data?.product ?? null;

  if (!product_id) throw new HttpsError("invalid-argument", "product_id is required");
  if (!meal) throw new HttpsError("invalid-argument", "meal is required");
  if (!date) throw new HttpsError("invalid-argument", "date is required");
  if (!Number.isFinite(grams) || grams <= 0) throw new HttpsError("invalid-argument", "grams must be > 0");

  // Count existing entries for this day for the meal (avoid composite-index requirement)
  const daySnap = await admin
    .firestore()
    .collection("food_diary")
    .where("user_id", "==", uid)
    .where("date", "==", date)
    .get();
  const existingForMeal = daySnap.docs.filter((d) => String((d.data() as any)?.meal ?? "") === meal).length;
  if (existingForMeal >= 5) {
    throw new HttpsError("resource-exhausted", "Meal diary limit reached");
  }

  const docRef = await admin.firestore().collection("food_diary").add({
    user_id: uid,
    product_id,
    meal,
    grams,
    date,
    product,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, id: docRef.id };
});

export const adminDeleteUser = onCall(async (request) => {
  requireAdmin(request);

  const uid = String((request.data as any)?.uid ?? "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "uid is required");

  // Best-effort Firestore cleanup (Auth deletion can happen even if cleanup partially fails)
  try {
    await admin.firestore().collection("profiles").doc(uid).delete();
  } catch {
    // ignore
  }
  try {
    await admin.firestore().collection("user_roles").doc(uid).delete();
  } catch {
    // ignore
  }

  await deleteByQuery(admin.firestore().collection("food_diary").where("user_id", "==", uid));
  await deleteByQuery(admin.firestore().collection("daily_stats").where("user_id", "==", uid));
  await deleteByQuery(admin.firestore().collection("user_achievements").where("user_id", "==", uid));
  await deleteByQuery(admin.firestore().collection("activity_events").where("user_id", "==", uid));
  await deleteByQuery(admin.firestore().collection("products").where("added_by", "==", uid));

  try {
    await admin.auth().deleteUser(uid);
  } catch (e: any) {
    const code = String(e?.code ?? "");
    if (!code.includes("auth/user-not-found")) {
      throw new HttpsError("internal", e?.message ?? "Failed to delete auth user");
    }
  }

  return { ok: true };
});

export const adminToggleBlockUser = onCall(async (request) => {
  requireAdmin(request);

  const uid = String((request.data as any)?.uid ?? "").trim();
  const isBlocked = Boolean((request.data as any)?.isBlocked);
  if (!uid) throw new HttpsError("invalid-argument", "uid is required");

  await admin.firestore().collection("profiles").doc(uid).set(
    {
      is_blocked: isBlocked,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

export const adminSetUserRole = onCall(async (request) => {
  requireAdmin(request);

  const uid = String((request.data as any)?.uid ?? "").trim();
  const adminFlag = Boolean((request.data as any)?.admin ?? false);
  if (!uid) throw new HttpsError("invalid-argument", "uid is required");

  await admin.auth().setCustomUserClaims(uid, { admin: adminFlag });

  await admin.firestore().collection("user_roles").doc(uid).set(
    {
      user_id: uid,
      role: adminFlag ? "admin" : "user",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});
