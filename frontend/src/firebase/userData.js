import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "./client.js";

function userDocRef(uid) {
  const db = getFirestoreDb();
  if (!db || !uid) return null;
  return doc(db, "users", uid);
}

export async function loadUserData(uid) {
  const ref = userDocRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserData(uid, patch) {
  const ref = userDocRef(uid);
  if (!ref) return;
  await setDoc(
    ref,
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return;
  await saveUserData(user.uid, {
    profile: {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
    },
  });
}
