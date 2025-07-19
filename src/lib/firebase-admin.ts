// src/lib/firebase-admin.ts
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let app: App;

if (!getApps().length) {
  const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKeyBase64) {
    throw new Error('Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccountJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    console.log("Initializing new Firebase Admin SDK instance...");
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to decode or parse Firebase service account key. Ensure it's a valid Base64 encoded JSON string.", error);
    throw new Error("Firebase Admin SDK initialization failed due to invalid credentials.");
  }
} else {
  app = getApps()[0]!;
}

export const auth = getAuth(app);
export const db = app.firestore();
