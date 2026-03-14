import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import store from '~/store';

interface VoiceCallScreenProps {
  agentName: string;
  agentAvatar?: React.ReactNode;
  onEnd: () => void;
}

type CallState = 'idle' | 'listening' | 'processing' | 'speaking';

const VoiceCallScreen: React.FC<VoiceCallScreenProps> = ({ agentName, agentAvatar, onEnd }) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setAutoTranscribe = useSetRecoilState(store.autoTranscribeAudio);
  const setAutoSend = useSetRecoilState(store.autoSendText);
  const setAutoPlayback = useSetRecoilState(store.automaticPlayback);
  const [prevAutoTranscribe] = useRecoilState(store.autoTranscribeAudio);
  const [prevAutoSend] = useRecoilState(store.autoSendText);
  const [prevAutoPlayback] = useRecoilState(store.automaticPlayback);
  const prevSettingsRef = useRef({ autoTranscribe: prevAutoTranscribe, autoSend: prevAutoSend, autoPlayback: prevAutoPlayback });

  useEffect(() => {
    prevSettingsRef.current = { autoTranscribe: prevAutoTranscribe, autoSend: prevAutoSend, autoPlayback: prevAutoPlayback };
    setAutoTranscribe(true);
    setAutoSend(0);
    setAutoPlayback(true);

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoTranscribe(prevSettingsRef.current.autoTranscribe);
      setAutoSend(prevSettingsRef.current.autoSend);
      setAutoPlayback(prevSettingsRef.current.autoPlayback);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    onEnd();
  }, [onEnd]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gray-950 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-surface-secondary shadow-lg">
          {agentAvatar ?? (
            <span className="text-3xl font-bold text-text-secondary">
              {agentName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">{agentName}</h2>
        <p className="text-sm text-gray-400">{formatTime(duration)}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                callState === 'listening'
                  ? 'animate-pulse bg-emerald-400'
                  : callState === 'speaking'
                    ? 'animate-pulse bg-violet-400'
                    : callState === 'processing'
                      ? 'bg-amber-400/50'
                      : 'bg-gray-700'
              }`}
              style={{
                height: callState === 'idle' ? '8px' : `${12 + Math.random() * 28}px`,
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {callState === 'listening' && 'Ouvindo...'}
          {callState === 'processing' && 'Pensando...'}
          {callState === 'speaking' && `${agentName} falando...`}
          {callState === 'idle' && 'Toque o microfone para falar'}
        </p>
      </div>

      <div className="flex items-center gap-8">
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            isMuted
              ? 'bg-white/10 text-red-400'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          aria-label={isMuted ? 'Ativar microfone' : 'Silenciar'}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        <button
          type="button"
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700"
          aria-label="Encerrar chamada"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
};

export default VoiceCallScreen;
