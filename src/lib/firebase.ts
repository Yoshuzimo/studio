
import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, connectAuthEmulator } from 'firebase/auth'; // Added connectAuthEmulator
import { getFirestore, connectFirestoreEmulator,initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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
const storage = getStorage(app);
const auth = getAuth(app); 

if (process.env.NODE_ENV === 'development') {
  try {
    // Emulator connections are typically only for local development
    // connectFirestoreEmulator(db, 'localhost', 8080);
    // connectStorageEmulator(storage, 'localhost', 9199);
    // connectAuthEmulator(auth, "http://localhost:9099"); 
    // console.log("Firebase emulators would be connected here in dev if uncommented.");
  } catch (error) {
    console.warn("Error attempting to connect to Firebase emulators (lines are commented out).", error);
  }
}

export { db, storage, auth, app, EmailAuthProvider, reauthenticateWithCredential };

