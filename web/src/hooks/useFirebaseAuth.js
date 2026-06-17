import { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

export function useFirebaseAuth() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(null);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (loading) return;
    setLoading("google");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert(error.message);
    } finally {
      setLoading(null);
    }
  };

  const signInWithEmail = async (email, password) => {
    if (loading) return;
    setLoading("email");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Email sign-in error:", error);
      alert(error.message);
    } finally {
      setLoading(null);
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    if (loading) return;
    setLoading("email");
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
      // Force refresh the user object so the new displayName is immediately available
      await user.reload();
      setFirebaseUser({ ...auth.currentUser });
    } catch (error) {
      console.error("Email sign-up error:", error);
      alert(error.message);
    } finally {
      setLoading(null);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  };

  return {
    firebaseUser,
    isLoaded: firebaseUser !== undefined,
    isSignedIn: !!firebaseUser,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    loading
  };
}
