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

function requireAdmin(request: { auth?: { uid: string; token?: any } | null }) {
  const auth = requireAuth(request);
  if (!auth.token?.admin) {
    throw new HttpsError("permission-denied", "Admin privileges required");
  }
  return auth;
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
