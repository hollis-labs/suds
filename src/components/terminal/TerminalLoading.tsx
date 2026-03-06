"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TerminalLoadingProps {
  message?: string;
  className?: string;
}

const SPINNER_FRAMES = ["|", "/", "-", "\\"];

export function TerminalLoading({
  message = "Loading",
  className,
}: TerminalLoadingProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "font-mono text-sm text-terminal-green-dim",
        className
      )}
      role="status"
      aria-label={message}
    >
      <span className="text-terminal-green">{SPINNER_FRAMES[frame]}</span>{" "}
      {message}
      <span className="animate-blink">_</span>
    </div>
  );
}
