"use client";

import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalText } from "@/components/terminal";

interface DeathScreenProps {
  goldLost: number;
  onRespawn: () => void;
  className?: string;
}

export function DeathScreen({
  goldLost,
  onRespawn,
  className,
}: DeathScreenProps) {
  const keyboardHandlers = useMemo(
    () => ({
      r: onRespawn,
      R: onRespawn,
    }),
    [onRespawn]
  );

  useKeyboard(keyboardHandlers);

  // Grab focus so keyboard events reach document listeners
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/90 outline-none",
        className
      )}
    >
      <div
        className={cn(
          "border-2 border-terminal-red w-full max-w-md",
          "bg-terminal-bg shadow-[0_0_40px_rgba(255,0,0,0.15)]",
          "font-mono"
        )}
      >
        {/* Title bar */}
        <div className="px-3 py-1.5 border-b border-terminal-red bg-terminal-red/5 text-center">
          <span className="text-terminal-red text-sm font-bold tracking-widest">
            GAME OVER
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-center">
          {/* Main death message */}
          <div className="text-terminal-red text-lg font-bold tracking-wider">
            <TerminalText
              text="YOU HAVE FALLEN"
              speed={60}
              animate={true}
            />
          </div>

          {/* Flavor text */}
          <div className="text-terminal-red/70 text-sm">
            <TerminalText
              text="The darkness claims you..."
              speed={40}
              animate={true}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-terminal-red/30" />

          {/* Gold lost */}
          <div className="text-sm">
            <span className="text-terminal-red/70">Gold lost: </span>
            <span className="text-terminal-gold">{goldLost}</span>
          </div>

          {/* Respawn info */}
          <div className="text-terminal-red/50 text-xs leading-relaxed">
            You will respawn at your
            <br />
            last safe room.
          </div>

          {/* Divider */}
          <div className="border-t border-terminal-red/30" />

          {/* Respawn button */}
          <button
            onClick={onRespawn}
            className={cn(
              "text-terminal-red hover:text-terminal-green transition-colors text-sm",
              "px-4 py-1 border border-terminal-red hover:border-terminal-green"
            )}
          >
            [R] Respawn
          </button>
        </div>
      </div>
    </div>
  );
}
