import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Send, User, Bot } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getScenarioIdWithFallback, debugSessionData } from "@/utils/sessionUtils";

interface PatientSimulatorProps {
  sessionId: string;
  email: string;
  onSessionEnd: () => void;
  onShowEvaluation?: (sessionId: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function PatientSimulator({ sessionId, email, onSessionEnd, onShowEvaluation }: PatientSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [sessionStartTime] = useState(new Date());
  const [remainingTime, setRemainingTime] = useState(25 * 60); // 25 minutes in seconds
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Time's up - automatically end session
          endSessionMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to the latest message whenever messages change
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch session details
  const { data: session } = useQuery({
    queryKey: ['ecos-session', sessionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ecos/sessions/${sessionId}?email=${email}`);
      return response.session;
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (query: string) => {
      // Use session utilities to get the best available scenarioId
      const resolvedScenarioId = getScenarioIdWithFallback({
        session,
        sessionId: sessionId
      });

      console.log('🔄 [PatientSimulator] Sending message with resolved session details:', {
        email,
        sessionId,
        resolvedScenarioId,
        sessionScenarioId: session?.scenarioId,
        query: query.substring(0, 50) + '...'
      });

      // Debug session data for troubleshooting
      debugSessionData({
        sessionId,
        session,
        scenarioId: resolvedScenarioId
      });
      
      return apiRequest('POST', '/api/ecos/patient-simulator', {
        email,
        sessionId,
        query,
        scenarioId: resolvedScenarioId
      });
    },
    onSuccess: (data) => {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString() + '-user',
        role: 'user',
        content: currentQuery,
        timestamp: new Date().toISOString()
      };

      // Add assistant response
      const assistantMessage: Message = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setCurrentQuery("");
    }
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/ecos/sessions/${sessionId}`, {
        email,
        status: 'completed'
      });
    },
    onSuccess: () => {
      // If there are messages (meaningful interaction), show evaluation
      if (messages.length > 0 && onShowEvaluation) {
        onShowEvaluation(sessionId);
      } else {
        // No interaction occurred, go back to dashboard
        onSessionEnd();
      }
    },
    onError: (error) => {
      console.error('Error ending session:', error);
    }
  });

  const handleSendMessage = () => {
    if (currentQuery.trim()) {
      // Check if we have any way to resolve scenarioId before sending
      const resolvedScenarioId = getScenarioIdWithFallback({
        session,
        sessionId: sessionId
      });

      if (!resolvedScenarioId) {
        console.warn('⚠️ [PatientSimulator] No scenarioId available, message may use fallback prompt');
      }

      sendMessageMutation.mutate(currentQuery);
    }
  };

  const handleEndSession = () => {
    endSessionMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get scenario image based on scenario ID
  const getScenarioImage = () => {
    const scenarioId = session?.scenarioId || session?.scenario_id;
    const title = session?.scenario?.title?.toLowerCase() || '';

    const scenarioImages: Record<number, string> = {
      1: "/images/douleur_thoracique.png",
      2: "/images/douleur_thoracic.png",
      3: "/images/trauma_poignet.png",
      4: "/images/patient_psychiatrique.png",
      5: "/images/patient_age_choc.png", // État de choc - Patient âgé en médecine interne
      6: "/images/syndrome_du_canal_carpien.png",
      7: "/images/patient_psychiatrique.png",
    };

    if (scenarioId && scenarioImages[scenarioId]) {
      return scenarioImages[scenarioId];
    }

    // Fallback based on title keywords
    if (title.includes('psychiatrique') || title.includes('psychotique') || title.includes('schizophrén')) {
      return "/images/patient_psychiatrique.png";
    } else if (title.includes('choc') || title.includes('âgé') || title.includes('personne âgée') || title.includes('médecine interne')) {
      return "/images/patient_age_choc.png";
    } else if (title.includes('thoracique')) {
      return "/images/douleur_thoracique.png";
    } else if (title.includes('poignet') || title.includes('trauma')) {
      return "/images/trauma_poignet.png";
    }

    return "/images/cahier.png";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
      {/* Session Header */}
      <Card className="mb-6 border-2 border-blue-500">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-4 flex-1 min-w-0">
              {/* Patient Image */}
              <div className="flex-shrink-0">
                <img
                  src={getScenarioImage()}
                  alt={session?.scenario?.title || "Patient"}
                  className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>

              {/* Scenario Info */}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl">{session?.scenario?.title}</CardTitle>
                <p className="text-gray-600 mt-1 break-words">{session?.scenario?.description}</p>
              </div>
            </div>

            {/* Timer and Actions */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              <Badge
                variant="outline"
                className={`flex items-center space-x-1 ${remainingTime <= 60 ? 'bg-red-50 text-red-700 border-red-200' : ''}`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTime(remainingTime)}</span>
              </Badge>
              <Button
                onClick={handleEndSession}
                disabled={endSessionMutation.isPending}
              >
                {endSessionMutation.isPending ? 'Fermeture...' : 'Terminer la Session'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chat Interface */}
      <Card className="flex flex-col border-2 border-blue-500 h-[60vh] md:h-[70vh] lg:h-[75vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Simulation Patient</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 mb-4 p-3 md:p-4 bg-gray-50 rounded-lg">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                
                <p>Bonjour, je suis votre patient pour cet examen.</p>
                <p className="text-sm">Commencez votre consultation en me posant des questions.</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`min-w-0 max-w-full sm:max-w-[85%] md:max-w-[75%] p-3 rounded-lg break-words ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span className="text-xs opacity-75">
                      {message.role === 'user' ? 'Vous' : 'Patient'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words break-all">{message.content}</p>
                </div>
              </div>
            ))}

            {sendMessageMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-lg max-w-[70%]">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <span className="text-xs text-gray-500">Patient</span>
                  </div>
                  <div className="flex space-x-1 mt-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="flex space-x-2 min-w-0">
            <Textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              placeholder="Posez votre question au patient..."
              className="flex-1 border-2 border-blue-500 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!currentQuery.trim() || sendMessageMutation.isPending}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}