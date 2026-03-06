"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalModal, TerminalText } from "@/components/terminal";

interface LevelUpData {
  newLevel: number;
  hpGained: number;
  statIncreased: string;
  statValue: number;
  newAbilities: string[];
}

interface LevelUpModalProps {
  open: boolean;
  onClose: () => void;
  levelData: LevelUpData;
  className?: string;
}

export function LevelUpModal({
  open,
  onClose,
  levelData,
  className,
}: LevelUpModalProps) {
  const oldLevel = levelData.newLevel - 1;

  const keyboardHandlers = useMemo((): Record<string, () => void> => {
    if (!open) return {};
    return {
      Enter: onClose,
    };
  }, [open, onClose]);

  useKeyboard(keyboardHandlers, open);

  const statLabel = levelData.statIncreased.toUpperCase();

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title="LEVEL UP!"
      className={cn("shadow-[0_0_30px_rgba(255,215,0,0.15)]", className)}
    >
      <div className="font-mono space-y-3 text-center">
        {/* Title flash */}
        <div className="text-terminal-gold text-lg font-bold terminal-glow tracking-wider">
          <TerminalText text="LEVEL UP!" speed={40} animate={true} />
        </div>

        {/* Level change */}
        <div className="text-terminal-green text-sm">
          Level {oldLevel}{" "}
          <span className="text-terminal-gold">&rarr;</span>{" "}
          Level {levelData.newLevel}
        </div>

        {/* Divider */}
        <div className="border-t border-terminal-border" />

        {/* Stats */}
        <div className="text-left space-y-1 text-sm px-4">
          {/* HP gained */}
          <div className="text-terminal-green-dim">
            <span className="text-terminal-green">HP:</span>{" "}
            <span className="text-terminal-gold">
              +{levelData.hpGained}
            </span>
          </div>

          {/* Stat increased */}
          <div className="text-terminal-green-dim">
            <span className="text-terminal-green">{statLabel}:</span>{" "}
            {levelData.statValue - 1}{" "}
            <span className="text-terminal-gold">&rarr;</span>{" "}
            <span className="text-terminal-gold">{levelData.statValue}</span>
          </div>
        </div>

        {/* New abilities */}
        {levelData.newAbilities.length > 0 && (
          <>
            <div className="border-t border-terminal-border" />
            <div className="text-left space-y-1 px-4">
              {levelData.newAbilities.map((ability) => (
                <div key={ability}>
                  <div className="text-terminal-gold text-sm font-bold">
                    New Ability: {ability.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-t border-terminal-border" />

        {/* Continue */}
        <button
          onClick={onClose}
          className="text-terminal-green hover:terminal-glow transition-colors text-sm"
        >
          [Enter] Continue
        </button>
      </div>
    </TerminalModal>
  );
}
