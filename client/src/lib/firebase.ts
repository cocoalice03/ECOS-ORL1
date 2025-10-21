/**
 * Firebase Client Configuration
 *
 * Initializes Firebase Authentication for the frontend
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
  type UserCredential
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Debug: Log Firebase config (hide sensitive data in production)
console.log('🔧 Firebase Configuration:', {
  apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
  authDomain: firebaseConfig.authDomain || 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING',
  hasAllKeys: !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
});

// Debug: Check raw environment variables
console.log('🔍 Raw Environment Variables:');
console.log('  - VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ?
  `${import.meta.env.VITE_FIREBASE_API_KEY.substring(0, 15)}...` : 'UNDEFINED');
console.log('  - VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'UNDEFINED');
console.log('  - VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID || 'UNDEFINED');
console.log('  - All VITE_FIREBASE_* keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')));

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();

  // Configure Google provider
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });

  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.warn('⚠️ Application will continue without Firebase authentication');
  // Don't throw - allow app to work without Firebase
  // Firebase is optional for development with email-based auth
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User signed in with email:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('❌ Email sign in failed:', error.message);
    throw error;
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ User created with email:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('❌ Email sign up failed:', error.message);
    throw error;
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  if (!auth || !googleProvider) {
    const errorMsg = 'Firebase n\'est pas configuré correctement. Veuillez contacter l\'administrateur ou utiliser l\'authentification par email.';
    console.error('❌ Firebase auth not initialized - cannot use Google sign-in');
    console.error('   - auth:', auth ? 'initialized' : 'undefined');
    console.error('   - googleProvider:', googleProvider ? 'initialized' : 'undefined');
    throw new Error(errorMsg);
  }
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    console.log('✅ User signed in with Google:', userCredential.user.email);
    return userCredential;
  } catch (error: any) {
    console.error('❌ Google sign in failed:', error.message);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  if (!auth) {
    console.warn('⚠️ Firebase auth not initialized - skipping sign out');
    return;
  }
  try {
    await firebaseSignOut(auth);
    console.log('✅ User signed out');
  } catch (error: any) {
    console.error('❌ Sign out failed:', error.message);
    throw error;
  }
}

/**
 * Get current user's ID token
 */
export async function getCurrentUserToken(): Promise<string | null> {
  if (!auth) {
    console.warn('⚠️ Firebase auth not initialized - returning null token');
    return null;
  }
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (error: any) {
    console.error('❌ Failed to get user token:', error.message);
    return null;
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  if (!auth) {
    console.warn('⚠️ Firebase auth not initialized - returning null user');
    return null;
  }
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (!auth) {
    console.warn('⚠️ Firebase auth not initialized - auth state changes disabled');
    // Return a no-op unsubscribe function
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent to:', email);
  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error.message);
    throw error;
  }
}

// Export Firebase instances
export { app, auth, googleProvider };
export type { User, UserCredential };
