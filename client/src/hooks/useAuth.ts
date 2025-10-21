/**
 * useAuth Hook
 *
 * Custom hook for Firebase authentication with backend JWT integration
 */

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut as firebaseSignOut,
  getCurrentUserToken,
  onAuthChange
} from '@/lib/firebase';
import { apiRequest } from '@/lib/queryClient';

export interface AuthUser {
  uid: string;
  email: string;
  role?: 'admin' | 'student';
  emailVerified: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  jwtToken: string | null;
}

export interface AuthActions {
  loginWithEmail: (email: string, password: string) => Promise<AuthUser | null>;
  registerWithEmail: (email: string, password: string) => Promise<AuthUser | null>;
  loginWithGoogle: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    firebaseUser: null,
    loading: true,
    error: null,
    jwtToken: localStorage.getItem('jwtToken')
  });

  /**
   * Exchange Firebase ID token for backend JWT
   */
  const exchangeTokenWithBackend = async (firebaseUser: User): Promise<AuthUser> => {
    try {
      const idToken = await firebaseUser.getIdToken();

      // Call backend to exchange token
      const response = await apiRequest<{
        user: AuthUser;
        jwtToken: string;
      }>('POST', '/api/auth/firebase-login', {}, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      // Store JWT in localStorage
      localStorage.setItem('jwtToken', response.jwtToken);
      localStorage.setItem('userEmail', firebaseUser.email || '');

      setState(prev => ({
        ...prev,
        user: response.user,
        firebaseUser,
        jwtToken: response.jwtToken,
        loading: false,
        error: null
      }));

      console.log('✅ Token exchanged successfully:', {
        email: response.user.email,
        role: response.user.role,
        fullUser: response.user
      });
      return response.user;
    } catch (error: any) {
      console.error('❌ Token exchange failed:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to authenticate with backend',
        loading: false
      }));
      throw error;
    }
  };

  /**
   * Login with email and password
   */
  const loginWithEmail = async (email: string, password: string): Promise<AuthUser | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const userCredential = await signInWithEmail(email, password);
      const user = await exchangeTokenWithBackend(userCredential.user);
      return user;
    } catch (error: any) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Register with email and password
   */
  const registerWithEmail = async (email: string, password: string): Promise<AuthUser | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const userCredential = await signUpWithEmail(email, password);
      const user = await exchangeTokenWithBackend(userCredential.user);
      return user;
    } catch (error: any) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Login with Google
   */
  const loginWithGoogle = async (): Promise<AuthUser | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const userCredential = await signInWithGoogle();
      const user = await exchangeTokenWithBackend(userCredential.user);
      return user;
    } catch (error: any) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Logout
   */
  const logout = async (): Promise<void> => {
    try {
      await firebaseSignOut();

      // Clear local storage
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('userEmail');

      setState({
        user: null,
        firebaseUser: null,
        loading: false,
        error: null,
        jwtToken: null
      });

      console.log('✅ User logged out');
    } catch (error: any) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  };

  /**
   * Refresh Firebase token
   */
  const refreshToken = async (): Promise<void> => {
    const token = await getCurrentUserToken();
    if (token && state.firebaseUser) {
      await exchangeTokenWithBackend(state.firebaseUser);
    }
  };

  /**
   * Listen to Firebase auth state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        try {
          await exchangeTokenWithBackend(firebaseUser);
        } catch (error) {
          console.error('❌ Failed to sync with backend:', error);
          setState(prev => ({
            ...prev,
            user: null,
            firebaseUser: null,
            loading: false,
            error: 'Failed to sync with backend'
          }));
        }
      } else {
        // User is signed out
        setState({
          user: null,
          firebaseUser: null,
          loading: false,
          error: null,
          jwtToken: null
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    ...state,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    refreshToken
  };
}

/**
 * Get user-friendly error messages for Firebase errors
 */
function getFirebaseErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': 'Adresse email invalide',
    'auth/user-disabled': 'Ce compte a été désactivé',
    'auth/user-not-found': 'Aucun compte trouvé avec cette adresse email',
    'auth/wrong-password': 'Mot de passe incorrect',
    'auth/email-already-in-use': 'Cette adresse email est déjà utilisée',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères',
    'auth/operation-not-allowed': 'Cette opération n\'est pas autorisée',
    'auth/popup-closed-by-user': 'La fenêtre de connexion a été fermée',
    'auth/cancelled-popup-request': 'Demande de connexion annulée',
    'auth/network-request-failed': 'Erreur réseau. Veuillez vérifier votre connexion internet.'
  };

  return errorMessages[errorCode] || 'Une erreur est survenue lors de l\'authentification';
}
