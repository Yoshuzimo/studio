// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This function ensures that we initialize the Firebase Admin SDK only once.
const initializeAdmin = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Check if the service account key is available in environment variables
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error("Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    // In a deployed environment, we might want to throw an error or handle this differently
    // For now, we will log the error and initialization will likely fail or use default creds if available.
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey as string);
    console.log("Initializing Firebase Admin SDK with service account credentials.");
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin SDK initialization error from service account key:", error);
    // As a fallback for local development or other environments with Application Default Credentials
    console.log("Attempting to initialize Firebase Admin SDK with default credentials as a fallback.");
    return admin.initializeApp();
  }
};

const adminApp = initializeAdmin();

export const auth = adminApp.auth();
export const db = adminApp.firestore();
