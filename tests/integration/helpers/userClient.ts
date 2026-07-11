import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../../../src/services/firebaseService';
import { adminAuth } from './adminClient';

// Tests share a single Firestore client, so the auth token in use must fully
// switch between users before the next authenticated read/write runs. Signing
// out the previous user first drops the stale token, and forcing a token
// refresh after sign-in ensures Firestore attaches the NEW identity — otherwise
// a query issued immediately after switching users can still evaluate security
// rules against the previous user (e.g. an admin), producing flaky auth checks.
export async function signInUser(uid: string) {
  if (auth.currentUser && auth.currentUser.uid !== uid) {
    await signOut(auth);
  }
  const customToken = await adminAuth.createCustomToken(uid);
  const userCredential = await signInWithCustomToken(auth, customToken);
  // Mint a fresh ID token so subsequent Firestore requests carry this user.
  await userCredential.user.getIdToken(true);
  return userCredential.user;
}

export async function signOutUser() {
  await signOut(auth);
}
