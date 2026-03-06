"use client";

import { useCallback, useEffect, useState, useRef } from "react";

const STORAGE_KEY = "suds-sound-enabled";

function getStoredEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume: number = 0.08
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function useSound() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setEnabled(getStoredEnabled());
  }, []);

  const getCtx = useCallback((): AudioContext | null => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, [enabled]);

  const playClick = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 800, 0.05, "square", 0.06);
  }, [getCtx]);

  const playBeep = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 440, 0.1, "square", 0.08);
  }, [getCtx]);

  const playError = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 300, 0.1, "sawtooth", 0.08);
    setTimeout(() => playTone(ctx, 200, 0.15, "sawtooth", 0.06), 100);
  }, [getCtx]);

  const playVictory = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 523, 0.08, "square", 0.06);
    setTimeout(() => playTone(ctx, 659, 0.08, "square", 0.06), 80);
    setTimeout(() => playTone(ctx, 784, 0.08, "square", 0.06), 160);
    setTimeout(() => playTone(ctx, 1047, 0.15, "square", 0.08), 240);
  }, [getCtx]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      // Create context on first enable (requires user gesture)
      if (next && !ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      return next;
    });
  }, []);

  return { playClick, playBeep, playError, playVictory, enabled, toggle };
}
