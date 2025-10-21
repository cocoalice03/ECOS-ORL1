/**
 * Password Reset Modal Component
 *
 * Modal for users to request a password reset email
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendPasswordReset } from '@/lib/firebase';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface PasswordResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PasswordResetModal({
  open,
  onOpenChange,
}: PasswordResetModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Veuillez entrer votre adresse email');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await sendPasswordReset(email);
      setSuccess(true);
      setEmail('');

      // Close modal after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);

      // Translate Firebase error messages
      const errorMessage = getPasswordResetErrorMessage(err.code);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            Entrez votre adresse email pour recevoir un lien de réinitialisation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {success && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-email">Adresse email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || success}>
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get user-friendly error messages for password reset errors
 */
function getPasswordResetErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': 'Adresse email invalide',
    'auth/user-not-found': 'Aucun compte trouvé avec cette adresse email',
    'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion internet',
    'auth/missing-email': 'Veuillez entrer une adresse email',
  };

  return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
}
