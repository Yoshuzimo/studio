// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    console.log("Initializing Firebase Admin SDK...");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to parse Firebase service account key. Ensure it's a valid JSON string.", error);
    throw new Error("Firebase Admin SDK initialization failed due to invalid credentials.");
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
export default admin;
