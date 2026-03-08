"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalModal, TerminalText } from "@/components/terminal";
import { PixelModal } from "@/components/pixel/PixelModal";
import { PixelButton } from "@/components/pixel/PixelButton";
import { RARITY } from "@/lib/constants";
import type { GameItem } from "@/lib/types";

interface VictoryScreenProps {
  xpGained: number;
  goldGained: number;
  loot: GameItem[];
  onContinue: () => void;
  isPixelMode?: boolean;
  className?: string;
}

export function VictoryScreen({
  xpGained,
  goldGained,
  loot,
  onContinue,
  isPixelMode,
  className,
}: VictoryScreenProps) {
  const keyboardHandlers = useMemo(
    () => ({
      Enter: onContinue,
    }),
    [onContinue]
  );

  useKeyboard(keyboardHandlers);

  const Modal = isPixelMode ? PixelModal : TerminalModal;

  const content = (
    <div className="font-mono space-y-3 text-center">
      {/* Title */}
      <div
        className={cn(
          "text-lg font-bold tracking-wider",
          isPixelMode ? "text-[#ffd700]" : "text-terminal-gold terminal-glow"
        )}
      >
        <TerminalText text="VICTORY!" speed={40} animate={true} />
      </div>

      {/* Divider */}
      <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />

      {/* Rewards */}
      <div className="text-left space-y-1 text-sm px-4">
        {/* XP */}
        <div className={cn(isPixelMode ? "text-[#1a8c1a]" : "text-terminal-green-dim")}>
          <span className={cn(isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green")}>XP gained:</span>{" "}
          <span className="text-terminal-purple">+{xpGained}</span>
        </div>

        {/* Gold */}
        <div className={cn(isPixelMode ? "text-[#1a8c1a]" : "text-terminal-green-dim")}>
          <span className={cn(isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green")}>Gold found:</span>{" "}
          <span className={cn(isPixelMode ? "text-[#ffd700]" : "text-terminal-gold")}>+{goldGained}</span>
        </div>
      </div>

      {/* Loot */}
      {loot.length > 0 && (
        <>
          <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />
          <div className="text-left space-y-1 px-4">
            <div
              className={cn(
                "text-xs uppercase tracking-wider mb-1",
                isPixelMode ? "text-[#c8e6c8]" : "text-terminal-green"
              )}
            >
              Loot:
            </div>
            {loot.map((item) => {
              const rarityInfo = RARITY[item.rarity];
              return (
                <div key={item.id} className="text-sm flex items-baseline gap-2">
                  <span className={cn(isPixelMode ? "text-[#1a8c1a]" : "text-terminal-green-dim")}>-</span>
                  <span className={rarityInfo.color}>
                    {item.name}
                    {item.quantity > 1 && ` x${item.quantity}`}
                  </span>
                  <span className={cn("text-[10px]", isPixelMode ? "text-[#1a8c1a]" : "text-terminal-border-bright")}>
                    ({rarityInfo.name})
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Divider */}
      <div className={cn("border-t", isPixelMode ? "border-[#1a3a1a]" : "border-terminal-border")} />

      {/* Continue */}
      {isPixelMode ? (
        <PixelButton variant="action" onClick={onContinue} size="sm">
          [Enter] Continue
        </PixelButton>
      ) : (
        <button
          onClick={onContinue}
          className="text-terminal-green hover:terminal-glow transition-colors text-sm px-4 py-2 border border-terminal-green hover:bg-terminal-green/10"
        >
          [Enter] Continue
        </button>
      )}
    </div>
  );

  return (
    <Modal
      open={true}
      onClose={onContinue}
      title="VICTORY!"
      className={cn("shadow-[0_0_30px_rgba(255,215,0,0.15)]", className)}
    >
      {content}
    </Modal>
  );
}
