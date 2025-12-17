import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

export const isFirebaseConfigured =
  !!firebaseConfig?.apiKey && !!firebaseConfig?.authDomain && !!firebaseConfig?.projectId;

let app;
let auth;
let db;

export function getFirebase() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase not configured. Paste your web app config into src/firebaseConfig.js');
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth, db };
}

export function subscribeToAuth(cb) {
  const { auth: a } = getFirebase();
  return onAuthStateChanged(a, cb);
}

export async function signUpWithEmailPassword(email, password) {
  const { auth: a } = getFirebase();
  return await createUserWithEmailAndPassword(a, email, password);
}

export async function signInWithEmailPassword(email, password) {
  const { auth: a } = getFirebase();
  return await signInWithEmailAndPassword(a, email, password);
}

export async function signOutUser() {
  const { auth: a } = getFirebase();
  return await signOut(a);
}

export async function getUserVote(uid) {
  const { db: firestore } = getFirebase();
  const ref = doc(firestore, 'votes', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserVote({ uid, email, displayName, vote }) {
  const { db: firestore } = getFirebase();
  const ref = doc(firestore, 'votes', uid);

  // One vote per user: doc id == uid. Re-saving overwrites that user's vote.
  await setDoc(
    ref,
    {
      uid,
      email: email ?? null,
      displayName: displayName ?? null,
      vote, // "yes" | "no"
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}


