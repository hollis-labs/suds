"use client";

import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalText } from "@/components/terminal";
import { PixelButton } from "@/components/pixel/PixelButton";

interface DeathScreenProps {
  goldLost: number;
  onRespawn: () => void;
  isPixelMode?: boolean;
  className?: string;
}

export function DeathScreen({
  goldLost,
  onRespawn,
  isPixelMode,
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
          "border-2 w-full max-w-md font-mono",
          isPixelMode
            ? "border-[#ff4444] bg-[#0d140d] shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]"
            : "border-terminal-red bg-terminal-bg shadow-[0_0_40px_rgba(255,0,0,0.15)]"
        )}
      >
        {/* Title bar */}
        <div
          className={cn(
            "px-3 py-1.5 border-b text-center",
            isPixelMode
              ? "border-[#ff4444] bg-[#ff4444]/10"
              : "border-terminal-red bg-terminal-red/5"
          )}
        >
          <span
            className={cn(
              "text-sm font-bold tracking-widest",
              isPixelMode ? "text-[#ff4444]" : "text-terminal-red"
            )}
          >
            GAME OVER
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-center">
          {/* Main death message */}
          <div
            className={cn(
              "text-lg font-bold tracking-wider",
              isPixelMode ? "text-[#ff4444]" : "text-terminal-red"
            )}
          >
            <TerminalText
              text="YOU HAVE FALLEN"
              speed={60}
              animate={true}
            />
          </div>

          {/* Flavor text */}
          <div className={cn("text-sm", isPixelMode ? "text-[#ff4444]/70" : "text-terminal-red/70")}>
            <TerminalText
              text="The darkness claims you..."
              speed={40}
              animate={true}
            />
          </div>

          {/* Divider */}
          <div className={cn("border-t", isPixelMode ? "border-[#ff4444]/30" : "border-terminal-red/30")} />

          {/* Gold lost */}
          <div className="text-sm">
            <span className={cn(isPixelMode ? "text-[#ff4444]/70" : "text-terminal-red/70")}>Gold lost: </span>
            <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>{goldLost}</span>
          </div>

          {/* Respawn info */}
          <div className={cn("text-xs leading-relaxed", isPixelMode ? "text-[#ff4444]/50" : "text-terminal-red/50")}>
            You will respawn at your
            <br />
            last safe room.
          </div>

          {/* Divider */}
          <div className={cn("border-t", isPixelMode ? "border-[#ff4444]/30" : "border-terminal-red/30")} />

          {/* Respawn button */}
          {isPixelMode ? (
            <PixelButton variant="danger" onClick={onRespawn} size="sm">
              [R] Respawn
            </PixelButton>
          ) : (
            <button
              onClick={onRespawn}
              className={cn(
                "text-terminal-red hover:text-terminal-green transition-colors text-sm",
                "px-4 py-1 border border-terminal-red hover:border-terminal-green"
              )}
            >
              [R] Respawn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
