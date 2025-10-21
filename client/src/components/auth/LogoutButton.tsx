/**
 * Logout Button Component
 *
 * Reusable logout button with Firebase authentication
 */

import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export default function LogoutButton({
  variant = 'outline',
  className = ''
}: LogoutButtonProps) {
  const { logout, loading } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Se déconnecter
    </Button>
  );
}
