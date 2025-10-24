import { useState } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceMicrophoneProps {
  onTranscript?: (text: string) => void;
  className?: string;
}

export default function VoiceMicrophone({ onTranscript, className }: VoiceMicrophoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const {
    isConnected,
    isRecording,
    isSpeaking,
    transcript,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useRealtimeVoice({
    onTranscript: (text) => {
      onTranscript?.(text);
    },
    onResponse: (text) => {
      setResponseText(prev => prev + text);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setError(null);
      setResponseText('');
      if (!isConnected) {
        await connect();
      }
      await startRecording();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setResponseText('');
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Main microphone button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleToggleRecording}
          disabled={!isConnected && !isRecording}
          className={cn(
            'relative w-14 h-14 rounded-full transition-all duration-300',
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/50' 
              : 'bg-primary hover:bg-primary/90'
          )}
          title={isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement vocal'}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
          
          {/* Recording indicator */}
          {isRecording && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
          )}
        </Button>

        {/* Connection toggle */}
        {!isConnected ? (
          <Button
            onClick={connect}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecter
          </Button>
        ) : (
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
          >
            Déconnecter
          </Button>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
            <Volume2 className="w-4 h-4" />
            <span className="font-medium">En train de parler...</span>
          </div>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className={cn(
          'px-2 py-1 rounded-full flex items-center gap-1',
          isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          )} />
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </div>

        {isRecording && (
          <div className="px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Enregistrement en cours
          </div>
        )}
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-600 font-medium mb-1">Votre question :</p>
          <p className="text-sm text-blue-900">{transcript}</p>
        </div>
      )}

      {/* Response display */}
      {responseText && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-600 font-medium mb-1">Réponse :</p>
          <p className="text-sm text-green-900">{responseText}</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600 font-medium mb-1">Erreur :</p>
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Instructions */}
      {!isConnected && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            💡 Cliquez sur "Connecter" puis sur le microphone pour commencer une conversation vocale en temps réel avec GPT-4o.
          </p>
        </div>
      )}
    </div>
  );
}
