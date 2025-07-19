// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

let adminApp: admin.app.App;

function getFirebaseAdmin() {
  if (!adminApp) {
    const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKeyBase64) {
      throw new Error('Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    }

    try {
      // Decode the Base64 string to get the original JSON string
      const serviceAccountJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      console.log("Initializing Firebase Admin SDK from decoded key...");
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error("Failed to decode or parse Firebase service account key. Ensure it's a valid Base64 encoded JSON string.", error);
      throw new Error("Firebase Admin SDK initialization failed due to invalid credentials.");
    }
  }
  return adminApp;
}

// Export functions that will call getFirebaseAdmin() on first use
export const auth = () => getFirebaseAdmin().auth();
export const db = () => getFirebaseAdmin().firestore();
