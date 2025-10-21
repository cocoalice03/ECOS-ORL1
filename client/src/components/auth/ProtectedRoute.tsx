/**
 * Protected Route Component
 *
 * Wrapper for routes that require authentication
 * Redirects to login if user is not authenticated
 */

import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Save the current path to redirect back after login
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('redirectAfterLogin', currentPath);

      // Redirect to login
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!loading && user && requireAdmin && user.role !== 'admin') {
      // User is authenticated but not admin
      setLocation('/');
    }
  }, [user, loading, requireAdmin, setLocation]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-neutral-600 text-sm">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - will redirect via useEffect
  if (!user) {
    return null;
  }

  // Admin required but user is not admin
  if (requireAdmin && user.role !== 'admin') {
    return null;
  }

  // User is authenticated - show the protected content
  return <>{children}</>;
}
