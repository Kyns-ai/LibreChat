import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilState } from 'recoil';
import { PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import store from '~/store';

interface VoiceCallScreenProps {
  agentName: string;
  agentAvatar?: React.ReactNode;
  onEnd: () => void;
}

type CallState = 'connecting' | 'listening' | 'processing' | 'speaking';

const WAVEFORM_BARS = 40;

const VoiceCallScreen: React.FC<VoiceCallScreenProps> = ({ agentName, agentAvatar, onEnd }) => {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [waveHeights, setWaveHeights] = useState<number[]>(() => Array(WAVEFORM_BARS).fill(3));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [prevAutoTranscribe, setAutoTranscribe] = useRecoilState(store.autoTranscribeAudio);
  const [prevAutoSend, setAutoSend] = useRecoilState(store.autoSendText);
  const [prevAutoPlayback, setAutoPlayback] = useRecoilState(store.automaticPlayback);
  const prevRef = useRef({ t: prevAutoTranscribe, s: prevAutoSend, p: prevAutoPlayback });

  useEffect(() => {
    prevRef.current = { t: prevAutoTranscribe, s: prevAutoSend, p: prevAutoPlayback };
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setAutoTranscribe(true);
    setAutoSend(0);
    setAutoPlayback(true);

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    const connectTimer = setTimeout(() => setCallState('listening'), 1500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
      clearTimeout(connectTimer);
      setAutoTranscribe(prevRef.current.t);
      setAutoSend(prevRef.current.s);
      setAutoPlayback(prevRef.current.p);
    };
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (callState === 'listening' || callState === 'speaking') {
      waveRef.current = setInterval(() => {
        setWaveHeights(
          Array.from({ length: WAVEFORM_BARS }, () =>
            callState === 'listening'
              ? 3 + Math.random() * 14
              : 4 + Math.random() * 24,
          ),
        );
      }, 120);
    } else {
      if (waveRef.current) clearInterval(waveRef.current);
      setWaveHeights(Array(WAVEFORM_BARS).fill(3));
    }
    return () => { if (waveRef.current) clearInterval(waveRef.current); };
  }, [callState]);

  const handleEnd = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    onEnd();
  }, [onEnd]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const stateLabel = {
    connecting: 'Conectando...',
    listening: 'Ouvindo...',
    processing: 'Pensando...',
    speaking: `${agentName} falando...`,
  };

  const waveColor = {
    connecting: 'bg-gray-600',
    listening: 'bg-emerald-500',
    processing: 'bg-amber-500/60',
    speaking: 'bg-violet-500',
  };

  const screen = (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 99999,
        background: 'linear-gradient(180deg, #075E54 0%, #054d44 40%, #02332e 100%)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-white/60" />
          <span className="text-xs text-white/60">KYNS Voice</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-white/80">
          {fmt(duration)}
        </span>
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {/* Avatar */}
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 shadow-2xl">
          {agentAvatar ?? (
            <span className="text-5xl font-bold text-white/80">
              {agentName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + status */}
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl font-semibold text-white">{agentName}</h2>
          <p className="text-sm text-emerald-200/80">{stateLabel[callState]}</p>
        </div>

        {/* Waveform */}
        <div className="flex h-12 w-full max-w-xs items-center justify-center gap-[2px]">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-100 ${waveColor[callState]}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-center gap-10 pb-16 pt-6">
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
            isMuted
              ? 'bg-red-500/30 text-red-300'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        <button
          type="button"
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all hover:bg-red-500 hover:scale-105 active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>

        <div className="h-14 w-14" />
      </div>
    </div>
  );

  return createPortal(screen, document.body);
};

export default VoiceCallScreen;
