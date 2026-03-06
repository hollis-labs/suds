"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TerminalTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  animate?: boolean;
}

export function TerminalText({
  text,
  speed = 30,
  onComplete,
  className,
  animate = true,
}: TerminalTextProps) {
  const [displayedLength, setDisplayedLength] = useState(animate ? 0 : text.length);
  const [isComplete, setIsComplete] = useState(!animate);

  const handleComplete = useCallback(() => {
    setIsComplete(true);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!animate) {
      setDisplayedLength(text.length);
      setIsComplete(true);
      return;
    }

    setDisplayedLength(0);
    setIsComplete(false);
  }, [text, animate]);

  useEffect(() => {
    if (!animate || isComplete) return;

    if (displayedLength >= text.length) {
      handleComplete();
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedLength((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedLength, text.length, speed, animate, isComplete, handleComplete]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {text.slice(0, displayedLength)}
      {!isComplete && (
        <span className="animate-typing-cursor inline-block w-[0.6em]">
          |
        </span>
      )}
    </span>
  );
}
