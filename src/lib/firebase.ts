import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
const auth = getAuth(app); 

// We are no longer using Firebase Storage for icons, so it has been removed.

export { db, auth, app, EmailAuthProvider, reauthenticateWithCredential };
