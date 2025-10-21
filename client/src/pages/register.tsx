/**
 * Register Page
 *
 * Firebase Authentication registration with Email/Password and Google Sign-In
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserPlus, Mail, User } from 'lucide-react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { registerWithEmail, loginWithGoogle, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationError(null);
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password) {
      setValidationError('Email et mot de passe sont requis');
      return;
    }

    if (formData.password.length < 6) {
      setValidationError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await registerWithEmail(
        formData.email,
        formData.password
      );

      if (user) {
        // Redirect based on role
        if (user.role === 'admin') {
          setLocation('/admin');
        } else {
          setLocation(`/student/${formData.email}`);
        }
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      const user = await loginWithGoogle();

      if (user) {
        // Redirect based on role
        if (user.role === 'admin') {
          setLocation('/admin');
        } else {
          setLocation(`/student/${user.email}`);
        }
      }
    } catch (err: any) {
      console.error('Google registration failed:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
              <UserPlus className="text-primary h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Créer un compte
          </CardTitle>
          <CardDescription className="text-center">
            Inscrivez-vous pour accéder à ECOS-ORL
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertDescription>{validationError || error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="pl-10"
                    disabled={loading || isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Dupont"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="pl-10"
                    disabled={loading || isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10"
                  required
                  disabled={loading || isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading || isSubmitting}
              />
              <p className="text-xs text-neutral-500">
                Minimum 6 caractères
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={loading || isSubmitting}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || isSubmitting || !formData.email || !formData.password}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création du compte...
                </>
              ) : (
                'S\'inscrire'
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

          <GoogleLoginButton onClick={handleGoogleRegister} disabled={loading} />
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-neutral-600">
            Vous avez déjà un compte ?{' '}
            <a
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Se connecter
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
