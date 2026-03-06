"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalModal, TerminalText } from "@/components/terminal";
import { RARITY } from "@/lib/constants";
import type { GameItem } from "@/lib/types";

interface VictoryScreenProps {
  xpGained: number;
  goldGained: number;
  loot: GameItem[];
  onContinue: () => void;
  className?: string;
}

export function VictoryScreen({
  xpGained,
  goldGained,
  loot,
  onContinue,
  className,
}: VictoryScreenProps) {
  const keyboardHandlers = useMemo(
    () => ({
      Enter: onContinue,
    }),
    [onContinue]
  );

  useKeyboard(keyboardHandlers);

  return (
    <TerminalModal
      open={true}
      onClose={onContinue}
      title="VICTORY!"
      className={cn("shadow-[0_0_30px_rgba(255,215,0,0.15)]", className)}
    >
      <div className="font-mono space-y-3 text-center">
        {/* Title */}
        <div className="text-terminal-gold text-lg font-bold terminal-glow tracking-wider">
          <TerminalText text="VICTORY!" speed={40} animate={true} />
        </div>

        {/* Divider */}
        <div className="border-t border-terminal-border" />

        {/* Rewards */}
        <div className="text-left space-y-1 text-sm px-4">
          {/* XP */}
          <div className="text-terminal-green-dim">
            <span className="text-terminal-green">XP gained:</span>{" "}
            <span className="text-terminal-purple">+{xpGained}</span>
          </div>

          {/* Gold */}
          <div className="text-terminal-green-dim">
            <span className="text-terminal-green">Gold found:</span>{" "}
            <span className="text-terminal-gold">+{goldGained}</span>
          </div>
        </div>

        {/* Loot */}
        {loot.length > 0 && (
          <>
            <div className="border-t border-terminal-border" />
            <div className="text-left space-y-1 px-4">
              <div className="text-terminal-green text-xs uppercase tracking-wider mb-1">
                Loot:
              </div>
              {loot.map((item) => {
                const rarityInfo = RARITY[item.rarity];
                return (
                  <div key={item.id} className="text-sm flex items-baseline gap-2">
                    <span className="text-terminal-green-dim">-</span>
                    <span className={rarityInfo.color}>
                      {item.name}
                      {item.quantity > 1 && ` x${item.quantity}`}
                    </span>
                    <span className="text-[10px] text-terminal-border-bright">
                      ({rarityInfo.name})
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-t border-terminal-border" />

        {/* Continue */}
        <button
          onClick={onContinue}
          className="text-terminal-green hover:terminal-glow transition-colors text-sm"
        >
          [Enter] Continue
        </button>
      </div>
    </TerminalModal>
  );
}
