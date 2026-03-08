"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalModal, TerminalText } from "@/components/terminal";
import { PixelModal } from "@/components/pixel/PixelModal";
import { PixelButton } from "@/components/pixel/PixelButton";

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
  isPixelMode?: boolean;
  className?: string;
}

export function LevelUpModal({
  open,
  onClose,
  levelData,
  isPixelMode,
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

  const Modal = isPixelMode ? PixelModal : TerminalModal;

  const content = (
    <div className="font-mono space-y-3 text-center">
      {/* Title flash */}
      <div
        className={cn(
          "text-lg font-bold tracking-wider",
          isPixelMode ? "text-[#ffd700]" : "text-terminal-gold terminal-glow"
        )}
      >
        <TerminalText text="LEVEL UP!" speed={40} animate={true} />
      </div>

      {/* Level change */}
      <div className={cn("text-sm", isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green")}>
        Level {oldLevel}{" "}
        <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>&rarr;</span>{" "}
        Level {levelData.newLevel}
      </div>

      {/* Divider */}
      <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />

      {/* Stats */}
      <div className="text-left space-y-1 text-sm px-4">
        {/* HP gained */}
        <div className={cn(isPixelMode ? "text-[#1a8c1a]" : "text-terminal-green-dim")}>
          <span className={cn(isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green")}>HP:</span>{" "}
          <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>
            +{levelData.hpGained}
          </span>
        </div>

        {/* Stat increased */}
        <div className={cn(isPixelMode ? "text-[#1a8c1a]" : "text-terminal-green-dim")}>
          <span className={cn(isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green")}>{statLabel}:</span>{" "}
          {levelData.statValue - 1}{" "}
          <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>&rarr;</span>{" "}
          <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>{levelData.statValue}</span>
        </div>
      </div>

      {/* New abilities */}
      {levelData.newAbilities.length > 0 && (
        <>
          <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />
          <div className="text-left space-y-1 px-4">
            {levelData.newAbilities.map((ability) => (
              <div key={ability}>
                <div className={cn("text-sm font-bold", isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>
                  New Ability: {ability.replace(/_/g, " ").toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Divider */}
      <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />

      {/* Continue */}
      {isPixelMode ? (
        <PixelButton variant="action" onClick={onClose} size="sm">
          [Enter] Continue
        </PixelButton>
      ) : (
        <button
          onClick={onClose}
          className="text-terminal-green hover:terminal-glow transition-colors text-sm"
        >
          [Enter] Continue
        </button>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="LEVEL UP!"
      className={cn("shadow-[0_0_30px_rgba(255,215,0,0.15)]", className)}
    >
      {content}
    </Modal>
  );
}
