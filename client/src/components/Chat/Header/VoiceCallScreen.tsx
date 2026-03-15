import React, { useRef, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { PhoneOff, Mic } from 'lucide-react';
import useSoundEffects from '~/hooks/Audio/useSoundEffects';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

interface VoiceCallScreenProps {
  agentName: string;
  agentVoice: string;
  agentAvatar?: React.ReactNode;
  onEnd: () => void;
}

type CallState = 'connecting' | 'idle' | 'listening' | 'processing' | 'speaking';

const BARS = 40;

function clickRecorderButton() {
  const btn = document.getElementById('audio-recorder');
  if (btn) btn.click();
}

function isRecorderActive() {
  const btn = document.getElementById('audio-recorder');
  return btn?.getAttribute('aria-pressed') === 'true';
}

const VoiceCallScreen: React.FC<VoiceCallScreenProps> = ({
  agentName,
  agentVoice,
  agentAvatar,
  onEnd,
}) => {
  const { token } = useAuthContext();
  const { playRing, playClick, playHangup } = useSoundEffects();

  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [subtitle, setSubtitle] = useState('');
  const [heights, setHeights] = useState<number[]>(() => Array(BARS).fill(3));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alive = useRef(true);
  const wasSubmitting = useRef(false);
  const lastSpokenText = useRef('');

  const isSubmitting = useRecoilValue(store.isSubmitting);
  const latestMessage = useRecoilValue(store.latestMessageFamily(0));
  const setAutoTranscribe = useSetRecoilState(store.autoTranscribeAudio);
  const setAutoSend = useSetRecoilState(store.autoSendText);
  const setAutoPlayback = useSetRecoilState(store.automaticPlayback);

  // Speak text using TTS manual endpoint
  const speakText = useCallback(
    async (text: string) => {
      if (!text.trim() || !token || !alive.current) return;
      try {
        setCallState('speaking');
        const formData = new FormData();
        formData.append('input', text);
        formData.append('voice', agentVoice);

        const res = await fetch('/api/files/speech/tts/manual', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok || !alive.current) {
          if (alive.current) setCallState('idle');
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (alive.current) setCallState('idle');
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (alive.current) setCallState('idle');
        };

        await audio.play();
      } catch {
        if (alive.current) setCallState('idle');
      }
    },
    [token, agentVoice],
  );

  // Mount
  useEffect(() => {
    setAutoTranscribe(true);
    setAutoSend(0);
    setAutoPlayback(false); // We handle TTS ourselves
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    pollRef.current = setInterval(() => {
      if (!alive.current) return;
      const recording = isRecorderActive();
      setCallState((prev) => {
        if (recording && prev !== 'listening') return 'listening';
        if (!recording && prev === 'listening') return 'processing';
        return prev;
      });
    }, 200);

    const t = setTimeout(() => {
      if (alive.current) {
        playRing();
        setCallState('idle');
      }
    }, 800);

    return () => {
      alive.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(t);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (isRecorderActive()) clickRecorderButton();
      setAutoTranscribe(false);
      setAutoSend(-1);
      setAutoPlayback(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When AI finishes responding, speak the response
  useEffect(() => {
    if (isSubmitting) {
      wasSubmitting.current = true;
      setCallState('processing');
    } else if (wasSubmitting.current) {
      wasSubmitting.current = false;
      if (!alive.current) return;

      // Get the AI response text
      const text = latestMessage?.text ?? '';
      if (text && !latestMessage?.isCreatedByUser && text !== lastSpokenText.current) {
        lastSpokenText.current = text;
        setSubtitle(text.length > 60 ? `${text.substring(0, 60)}...` : text);
        speakText(text);
      } else {
        setCallState('idle');
      }
    }
  }, [isSubmitting, latestMessage, speakText]);

  // Waveform
  useEffect(() => {
    if (waveRef.current) clearInterval(waveRef.current);
    if (callState === 'listening' || callState === 'speaking') {
      waveRef.current = setInterval(() => {
        setHeights(
          Array.from({ length: BARS }, () =>
            callState === 'listening' ? 3 + Math.random() * 16 : 4 + Math.random() * 26,
          ),
        );
      }, 120);
    } else if (callState === 'processing') {
      waveRef.current = setInterval(() => {
        setHeights((prev) => prev.map((_h, i) => 3 + Math.sin(Date.now() / 300 + i * 0.5) * 6));
      }, 80);
    } else {
      setHeights(Array(BARS).fill(3));
    }
    return () => {
      if (waveRef.current) clearInterval(waveRef.current);
    };
  }, [callState]);

  const handleMic = useCallback(() => {
    playClick();
    clickRecorderButton();
  }, [playClick]);

  const handleEnd = useCallback(() => {
    playHangup();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (isRecorderActive()) clickRecorderButton();
    setTimeout(onEnd, 400);
  }, [playHangup, onEnd]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const label: Record<CallState, string> = {
    connecting: 'Conectando...',
    idle: 'Toque para falar',
    listening: 'Ouvindo...',
    processing: 'Pensando...',
    speaking: `${agentName} falando...`,
  };

  const barColor: Record<CallState, string> = {
    connecting: 'bg-gray-600',
    idle: 'bg-gray-600',
    listening: 'bg-emerald-400',
    processing: 'bg-amber-400/60',
    speaking: 'bg-violet-400',
  };

  const micBusy =
    callState === 'connecting' || callState === 'processing' || callState === 'speaking';

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 99999,
        background: 'linear-gradient(180deg, #075E54 0%, #054d44 40%, #02332e 100%)',
      }}
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-14">
        <span className="text-xs text-white/50">KYNS Voice</span>
        <span className="text-xs font-medium tabular-nums text-white/70">{fmt(duration)}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/20 bg-white/10 shadow-2xl">
          {agentAvatar ?? (
            <span className="text-4xl font-bold text-white/80">
              {agentName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-2xl font-semibold text-white">{agentName}</h2>
          <p className="text-sm text-emerald-200/70">{label[callState]}</p>
        </div>

        <div className="flex h-12 w-full max-w-xs items-center justify-center gap-[2px]">
          {heights.map((h, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-100 ${barColor[callState]}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {subtitle && (
          <p className="max-w-xs text-center text-xs italic text-white/30">
            &ldquo;{subtitle}&rdquo;
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-12 pb-16 pt-6">
        <button
          type="button"
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all hover:scale-105 hover:bg-red-500 active:scale-95"
          aria-label="Encerrar chamada"
        >
          <PhoneOff className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={handleMic}
          disabled={micBusy}
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
            callState === 'listening'
              ? 'animate-pulse bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
              : micBusy
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/20 text-white shadow-lg hover:bg-white/30 active:scale-95'
          }`}
          aria-label={callState === 'listening' ? 'Parar de gravar' : 'Falar'}
        >
          <Mic className="h-7 w-7" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default VoiceCallScreen;
