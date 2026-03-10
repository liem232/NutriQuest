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

async function main() {
  initAdmin();

  const uid = String(process.argv[2] ?? "").trim();
  const flag = String(process.argv[3] ?? "true").toLowerCase() !== "false";

  if (!uid) {
    console.error("Usage: node ./scripts/make-admin.mjs <uid> [true|false]");
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(uid, { admin: flag });

  await admin.firestore().collection("user_roles").doc(uid).set(
    {
      user_id: uid,
      role: flag ? "admin" : "user",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Custom claim admin=${flag} set for uid=${uid}`);
  console.log("IMPORTANT: user must sign out and sign in again (or refresh token) to receive new claims.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
