import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/admin";
import TeacherPage from "@/pages/teacher";
import StudentPage from "@/pages/student";
import DiagnosticPage from "@/pages/diagnostic";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";
// Firebase auth removed - using simple localStorage auth
const authenticateWithEmail = (email: string) => {
  localStorage.setItem('userEmail', email);
  return { success: true, email };
};
const getStoredEmail = () => localStorage.getItem('userEmail');

interface AppProps {
  initialEmail: string | null;
}

function Router({ email }: { email: string | null }) {
  // Gérer toutes les routes, avec priorité pour l'admin
  return (
    <Switch>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/register">
        <RegisterPage />
      </Route>
      <Route path="/admin">
        <ProtectedRoute requireAdmin={true}>
          <AdminPage />
        </ProtectedRoute>
      </Route>
      <Route path="/diagnostic">
        <DiagnosticPage />
      </Route>

      {/* Protected routes - no email in URL needed */}
      <Route path="/teacher">
        <ProtectedRoute>
          <TeacherPage />
        </ProtectedRoute>
      </Route>
      <Route path="/student">
        <ProtectedRoute>
          <StudentPage />
        </ProtectedRoute>
      </Route>

      {/* Legacy routes with email for backwards compatibility */}
      <Route path="/teacher/:email">
        {(params) => <TeacherPage email={params.email} />}
      </Route>
      <Route path="/student/:email">
        {(params) => <StudentPage email={params.email} />}
      </Route>
      <Route path="/">
        <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-card">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                <MessageCircle className="text-primary text-3xl h-8 w-8" />
              </div>
            </div>
            <h3 className="text-center font-heading font-semibold text-xl mb-2">ECOS-ORL</h3>
            <p className="text-center text-neutral-600 mb-6">
              Plateforme d'apprentissage pour les examens cliniques
            </p>
            <div className="space-y-3">
              <a
                href="/login"
                className="block w-full text-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Se connecter
              </a>
              <a
                href="/register"
                className="block w-full text-center bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Créer un compte
              </a>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 mt-6 text-sm">
              <h4 className="font-medium text-blue-700 mb-2">Accès direct (développement) :</h4>
              <ol className="list-decimal pl-5 text-blue-700 space-y-2">
                <li>Mode Enseignant ECOS : <code className="bg-blue-100 px-1 py-0.5 rounded">/teacher/votre@email.com</code></li>
                <li>Mode Étudiant ECOS : <code className="bg-blue-100 px-1 py-0.5 rounded">/student/votre@email.com</code></li>
                <li>Administration : <code className="bg-blue-100 px-1 py-0.5 rounded">/admin</code></li>
              </ol>
            </div>
          </div>
        </div>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App({ initialEmail }: AppProps) {
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [authenticating, setAuthenticating] = useState<boolean>(!!initialEmail);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    async function authenticateUser() {
      if (initialEmail) {
        try {
          setAuthenticating(true);
          // Utiliser Firebase Auth au lieu de l'API webhook
          const authResult = await authenticateWithEmail(initialEmail);
          if (authResult.success) {
            setEmail(initialEmail);
          } else {
            console.error("Authentication error:", authResult.error);
            setEmail(null);
          }
        } catch (error) {
          console.error("Authentication error:", error);
          setEmail(null);
        } finally {
          setAuthenticating(false);
        }
      } else {
        // Vérifier si l'utilisateur a un email enregistré dans localStorage
        const storedEmail = getStoredEmail();
        if (storedEmail) {
          setEmail(storedEmail);
        }
      }
    }

    authenticateUser();
  }, [initialEmail]);

  useEffect(() => {
    async function detectUser() {
      try {
        // Vérifier si l'utilisateur a un email enregistré via Firebase
        const storedEmail = getStoredEmail();
        if (storedEmail) {
          setEmail(storedEmail);
        } else {
          // No stored email found - require user to provide email through URL
          setEmail(null);
        }
      } catch (error) {
        console.error('Error detecting user:', error);
        // Don't set a fallback email - require proper authentication
        setEmail(null);
      } finally {
        setIsLoading(false);
      }
    }

    if (!email && !authenticating) {
      // Detect user state
      detectUser();
    } else {
      setIsLoading(false);
    }
  }, [email, authenticating]);

  if (authenticating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600">Authentification en cours...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de l'application...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Route path=".*">
            <Router email={email} />
          </Route>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;