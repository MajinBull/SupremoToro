import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function readFirebaseWebConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

/** True se le variabili minime per Auth (e più avanti Firestore) sono presenti. */
export function isFirebaseConfigured() {
  const c = readFirebaseWebConfig();
  return Boolean(
    c.apiKey && c.authDomain && c.projectId && c.appId && c.messagingSenderId,
  );
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp(readFirebaseWebConfig());
}

/** @returns {import('firebase/auth').Auth | null} */
export function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

/** @returns {import('firebase/firestore').Firestore | null} */
export function getFirestoreDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}
