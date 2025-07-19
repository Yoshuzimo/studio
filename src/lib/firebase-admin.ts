// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

const initializeAdmin = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    console.log("Initializing Firebase Admin SDK with service account credentials.");
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to parse Firebase service account key. Ensure it's a valid JSON string.", error);
    throw new Error("Firebase Admin SDK initialization failed due to invalid credentials.");
  }
};

const adminApp = initializeAdmin();

export const auth = adminApp.auth();
export const db = adminApp.firestore();
