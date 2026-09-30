import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebaseConfig';

const GOOGLE_WEB_CLIENT_ID = '1053813152812-40tp0at0qk7nuhq10h8l1fj31qcofp0c.apps.googleusercontent.com';

if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}

/**
 * Sign up with email and password.
 * Returns the Firebase User object.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

/**
 * Sign in with email and password.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Send password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  if (Platform.OS !== 'web') {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore error if user wasn't signed in via Google
    }
  }
}

/**
 * Get the current user's ID token for API calls.
 * Returns null if not signed in.
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Get the current Firebase user (synchronous check).
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes.
 * Returns unsubscribe function.
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign in with Google.
 * On Web: Uses Firebase's signInWithPopup with GoogleAuthProvider.
 * On Android Native: Uses @react-native-google-signin/google-signin with GoogleAuthProvider.credential.
 */
export async function signInWithGoogle(): Promise<User> {
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  }

  // Native Android
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    const cancelErr: any = new Error('popup-closed-by-user');
    cancelErr.code = 'auth/popup-closed-by-user';
    throw cancelErr;
  }

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google Sign-In completed without providing an ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);
  return userCred.user;
}

