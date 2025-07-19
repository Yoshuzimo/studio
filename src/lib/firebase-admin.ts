import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // For local development, it can use application default credentials.
    // For deployed environments, FIREBASE_CONFIG is often set.
    console.log("Initializing Firebase Admin SDK with default credentials.");
    admin.initializeApp();
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
