"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface DiceRollerProps {
  finalValue: number;
  sides?: number;
  duration?: number;
  onComplete?: () => void;
  className?: string;
}

/**
 * Odometer/slot-machine style dice roller animation.
 * Each digit column spins through 5-15 full cycles of random numbers,
 * decelerating before settling on the final value left-to-right.
 */
export function DiceRoller({
  finalValue,
  sides = 20,
  duration = 1800,
  onComplete,
  className,
}: DiceRollerProps) {
  const digits = String(finalValue).split("");
  const columnCount = digits.length;
  const [settled, setSettled] = useState<boolean[]>(new Array(columnCount).fill(false));
  const [displayDigits, setDisplayDigits] = useState<string[]>(
    new Array(columnCount).fill("0")
  );
  const [phase, setPhase] = useState<"spinning" | "settling" | "done">("spinning");
  const intervalRefs = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completeFired = useRef(false);

  useEffect(() => {
    completeFired.current = false;
    setSettled(new Array(columnCount).fill(false));
    setPhase("spinning");

    // Clear previous
    intervalRefs.current.forEach(clearInterval);
    timeoutRefs.current.forEach(clearTimeout);
    intervalRefs.current = [];
    timeoutRefs.current = [];

    // Phase 1: Fast spin (60% of duration) — rapid cycling
    const fastPhaseEnd = duration * 0.55;
    // Phase 2: Deceleration + settle (remaining 45%)

    for (let col = 0; col < columnCount; col++) {
      // Start fast — 40ms interval
      let currentInterval = 40;
      let intervalId: ReturnType<typeof setInterval>;

      const tick = () => {
        setDisplayDigits((prev) => {
          const next = [...prev];
          next[col] = String(Math.floor(Math.random() * 10));
          return next;
        });
      };

      intervalId = setInterval(tick, currentInterval);
      intervalRefs.current.push(intervalId);

      // Schedule deceleration for this column
      const settleStart = fastPhaseEnd + (col * (duration * 0.4)) / (columnCount + 1);

      // Deceleration: switch to slower intervals
      const decelSteps = [
        { delay: settleStart, interval: 70 },
        { delay: settleStart + 120, interval: 120 },
        { delay: settleStart + 280, interval: 200 },
      ];

      for (const step of decelSteps) {
        const t = setTimeout(() => {
          clearInterval(intervalRefs.current[col]);
          intervalRefs.current[col] = setInterval(tick, step.interval);
        }, step.delay);
        timeoutRefs.current.push(t);
      }

      // Final settle
      const finalSettleTime = settleStart + 480;
      const t = setTimeout(() => {
        clearInterval(intervalRefs.current[col]);
        setDisplayDigits((prev) => {
          const next = [...prev];
          next[col] = digits[col]!;
          return next;
        });
        setSettled((prev) => {
          const next = [...prev];
          next[col] = true;
          return next;
        });
      }, finalSettleTime);
      timeoutRefs.current.push(t);
    }

    // Settling phase marker
    const settlePhaseTimer = setTimeout(() => setPhase("settling"), fastPhaseEnd);
    timeoutRefs.current.push(settlePhaseTimer);

    // Done
    const completeTimer = setTimeout(() => {
      setPhase("done");
      if (!completeFired.current) {
        completeFired.current = true;
        onComplete?.();
      }
    }, duration + 50);
    timeoutRefs.current.push(completeTimer);

    return () => {
      intervalRefs.current.forEach(clearInterval);
      timeoutRefs.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalValue, columnCount, duration]);

  return (
    <span className={cn("inline-flex items-center gap-0", className)}>
      <span className="text-terminal-border mr-0.5">[</span>
      <span className={cn(
        "text-terminal-amber mr-0.5 transition-all",
        phase === "spinning" && "animate-dice-label-buzz"
      )}>d{sides}</span>
      {displayDigits.map((digit, i) => (
        <span
          key={i}
          className={cn(
            "inline-block w-[0.7em] text-center font-bold",
            settled[i]
              ? "text-terminal-green terminal-glow animate-dice-land"
              : cn(
                  "text-terminal-amber",
                  phase === "spinning" && "animate-dice-buzz",
                  phase === "settling" && "animate-dice-settle"
                )
          )}
        >
          {digit}
        </span>
      ))}
      <span className="text-terminal-border ml-0.5">]</span>
    </span>
  );
}
