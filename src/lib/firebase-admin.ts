import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
     console.log("Firebase Admin SDK initialized with service account.");
  } catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
    // Fallback for local development or environments where default creds are expected
    if (!admin.apps.length) {
        console.log("Initializing Firebase Admin SDK with default credentials as fallback.");
        admin.initializeApp();
    }
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
