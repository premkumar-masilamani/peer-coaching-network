import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../../../src/services/firebaseService';
import { adminAuth } from './adminClient';

export async function signInUser(uid: string) {
  const customToken = await adminAuth.createCustomToken(uid);
  const userCredential = await signInWithCustomToken(auth, customToken);
  return userCredential.user;
}

export async function signOutUser() {
  await signOut(auth);
}
