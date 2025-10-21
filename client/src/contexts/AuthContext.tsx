/**
 * AuthContext
 *
 * Provides authentication state and actions throughout the application
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type AuthUser, type AuthState, type AuthActions } from '@/hooks/useAuth';

interface AuthContextValue extends AuthState, AuthActions {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  const contextValue: AuthContextValue = {
    ...auth,
    isAuthenticated: !!auth.user,
    isAdmin: auth.user?.role === 'admin',
    isStudent: auth.user?.role === 'student'
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

/**
 * Higher-Order Component to protect routes
 */
export interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireStudent?: boolean;
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireStudent = false,
  fallback = <LoginRedirect />
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isStudent, loading } = useAuthContext();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  if (requireAdmin && !isAdmin) {
    return <UnauthorizedMessage role="admin" />;
  }

  if (requireStudent && !isStudent && !isAdmin) {
    return <UnauthorizedMessage role="student" />;
  }

  return <>{children}</>;
}

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Chargement...</p>
      </div>
    </div>
  );
}

/**
 * Login redirect component
 */
function LoginRedirect() {
  React.useEffect(() => {
    // Redirect to login page
    window.location.href = '/login';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Authentification requise</h2>
        <p className="text-gray-600 mb-4">Redirection vers la page de connexion...</p>
      </div>
    </div>
  );
}

/**
 * Unauthorized message component
 */
function UnauthorizedMessage({ role }: { role: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-2xl font-bold text-red-800 mb-4">
          Accès non autorisé
        </h2>
        <p className="text-red-700 mb-4">
          Cette page nécessite un rôle <strong>{role}</strong>.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to require authentication
 * Throws error if not authenticated
 */
export function useRequireAuth(): AuthContextValue {
  const auth = useAuthContext();

  if (!auth.isAuthenticated) {
    throw new Error('Authentication required');
  }

  return auth;
}

/**
 * Hook to require admin role
 * Throws error if not admin
 */
export function useRequireAdmin(): AuthContextValue {
  const auth = useAuthContext();

  if (!auth.isAdmin) {
    throw new Error('Admin role required');
  }

  return auth;
}
