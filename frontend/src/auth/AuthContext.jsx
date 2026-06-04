import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../firebase/client.js";
import { ensureUserProfile } from "../firebase/userData.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setLastError(null);
      if (u) {
        ensureUserProfile(u).catch(() => {
          /* profile sync is non-blocking */
        });
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLastError(null);
    if (!isFirebaseConfigured()) {
      const err = new Error("Firebase non configurato");
      setLastError(err);
      throw err;
    }
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e?.code === "auth/popup-closed-by-user") return;
      setLastError(e);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setLastError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      lastError,
      configured: isFirebaseConfigured(),
      signInWithGoogle,
      signOut,
      getIdToken,
    }),
    [user, loading, lastError, signInWithGoogle, signOut, getIdToken],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve essere usato dentro AuthProvider");
  }
  return ctx;
}
