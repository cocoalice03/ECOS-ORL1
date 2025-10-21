/**
 * Login Page
 *
 * Firebase Authentication login with Email/Password and Google Sign-In
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Mail } from 'lucide-react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import PasswordResetModal from '@/components/auth/PasswordResetModal';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { loginWithEmail, loginWithGoogle, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Check if there's a redirect path saved
  const redirectPath = localStorage.getItem('redirectAfterLogin');
  const hasRedirect = !!redirectPath;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await loginWithEmail(email, password);

      if (user) {
        // Show redirecting state
        setIsRedirecting(true);

        // Small delay to show the redirecting message
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if there's a saved redirect path
        const redirectPath = localStorage.getItem('redirectAfterLogin');

        if (redirectPath) {
          // Clear the saved path
          localStorage.removeItem('redirectAfterLogin');
          // Set flag for welcome banner if redirecting to student page
          if (redirectPath.startsWith('/student')) {
            sessionStorage.setItem('justLoggedIn', 'true');
          }
          // Redirect to the saved path
          setLocation(redirectPath);
        } else {
          // Default redirect based on role
          if (user.role === 'admin') {
            setLocation('/admin');
          } else {
            // Set flag for welcome banner
            sessionStorage.setItem('justLoggedIn', 'true');
            setLocation('/student');
          }
        }
      }
    } catch (err: any) {
      console.error('Login failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const user = await loginWithGoogle();

      if (user) {
        // Show redirecting state
        setIsRedirecting(true);

        // Small delay to show the redirecting message
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if there's a saved redirect path
        const redirectPath = localStorage.getItem('redirectAfterLogin');

        if (redirectPath) {
          // Clear the saved path
          localStorage.removeItem('redirectAfterLogin');
          // Set flag for welcome banner if redirecting to student page
          if (redirectPath.startsWith('/student')) {
            sessionStorage.setItem('justLoggedIn', 'true');
          }
          // Redirect to the saved path
          setLocation(redirectPath);
        } else {
          // Default redirect based on role
          if (user.role === 'admin') {
            setLocation('/admin');
          } else {
            // Set flag for welcome banner
            sessionStorage.setItem('justLoggedIn', 'true');
            setLocation('/student');
          }
        }
      }
    } catch (err: any) {
      console.error('Google login failed:', err);
    }
  };

  // Show redirecting screen
  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse"></div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Connexion réussie!</h3>
            <p className="text-sm text-gray-600">
              Redirection vers {redirectPath || 'votre espace'}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
              <LogIn className="text-primary h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Connexion
          </CardTitle>
          <CardDescription className="text-center">
            Connectez-vous à votre compte ECOS-ORL
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {hasRedirect && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Après connexion, vous serez redirigé vers <strong>{redirectPath}</strong>
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading || isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-sm text-primary hover:underline"
                  disabled={loading || isSubmitting}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || isSubmitting}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || isSubmitting || !email || !password}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-neutral-500">
                Ou continuer avec
              </span>
            </div>
          </div>

          <GoogleLoginButton onClick={handleGoogleLogin} disabled={loading} />
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-neutral-600">
            Pas encore de compte ?{' '}
            <a
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              S'inscrire
            </a>
          </div>
        </CardFooter>
      </Card>

      {/* Password Reset Modal */}
      <PasswordResetModal
        open={showResetModal}
        onOpenChange={setShowResetModal}
      />
    </div>
  );
}
