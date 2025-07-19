
// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

// This is a robust singleton pattern for initializing Firebase Admin in a serverless environment.
// It ensures that we don't try to initialize the app more than once.
let adminApp: App;

function getFirebaseAdmin(): App {
  if (admin.apps.length > 0) {
    // If an app is already initialized, return it.
    // In a serverless environment, this helps reuse the existing instance across invocations.
    return admin.apps[0]!;
  }

  const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKeyBase64) {
    throw new Error('Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccountJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    console.log("Initializing new Firebase Admin SDK instance...");
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return adminApp;
  } catch (error) {
    console.error("Failed to decode or parse Firebase service account key. Ensure it's a valid Base64 encoded JSON string.", error);
    throw new Error("Firebase Admin SDK initialization failed due to invalid credentials.");
  }
}

// Export functions that will call the singleton getter on first use.
// This ensures the admin app is only initialized when one of these functions is actually called at runtime.
export const auth = () => getFirebaseAdmin().auth();
export const db = () => getFirebaseAdmin().firestore();
