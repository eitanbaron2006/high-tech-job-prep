import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Config loaded directly from provisioned firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0066141798",
  appId: "1:278883601898:web:b2af21d77a5d5dfdc67693",
  apiKey: "AIzaSyAjdYMe83dUDmRaBbqKng5Bx_fbyC1kTh0",
  authDomain: "gen-lang-client-0066141798.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-df7db11a-e114-47be-ad80-e52c046ef821",
  storageBucket: "gen-lang-client-0066141798.firebasestorage.app",
  messagingSenderId: "278883601898"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore specifying the database ID as provisioned
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
storage.maxUploadRetryTime = 120_000;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Standard login with Google function
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Save/update user profile in firestore
    const userRef = doc(db, "users", user.uid);
    try {
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName,
        createdAt: Timestamp.now().toDate().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
    
    return user;
  } catch (error) {
    console.error("Google authentication failed:", error);
    throw error;
  }
}

// Sign out function
export async function logout() {
  return signOut(auth);
}

// Test connectivity as requested in rules
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
