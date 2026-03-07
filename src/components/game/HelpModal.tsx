"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const CONTROLS = [
  { keys: "W / \u2191", action: "North" },
  { keys: "S / \u2193", action: "South" },
  { keys: "A / \u2190", action: "West" },
  { keys: "D / \u2192", action: "East" },
  { keys: "X", action: "Search room" },
  { keys: "R", action: "Rest (safe rooms)" },
  { keys: "F", action: "Interact with shrine" },
  { keys: "T", action: "Talk to NPC" },
  { keys: "B", action: "Shop at store" },
  { keys: "I", action: "Inventory" },
  { keys: "C", action: "Character sheet" },
  { keys: "P", action: "Party" },
  { keys: "L", action: "Codex / Lore" },
  { keys: "N", action: "News" },
  { keys: "~", action: "About" },
  { keys: "Q", action: "Exit to character select" },
  { keys: "?", action: "This help menu" },
];

const COMBAT_KEYS = [
  { keys: "1-5", action: "Action selection" },
  { keys: "Esc", action: "Cancel / go back" },
];

const TIPS = [
  "Explore to find stores, NPCs, and loot",
  "Rest at safe rooms (campfire) to save your position",
  "Your base unlocks at level 5",
  "Watch your HP \u2014 death costs 25% of your gold",
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  const keyboardHandlers = useMemo(
    () => ({
      Escape: onClose,
    }),
    [onClose]
  );

  useKeyboard(keyboardHandlers, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        className={cn(
          "relative z-10 w-full max-w-md",
          "border-2 border-terminal-border bg-terminal-bg",
          "shadow-[0_0_20px_rgba(51,255,51,0.1)]"
        )}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-bg-alt">
          <span className="text-sm text-terminal-green terminal-glow select-none">
            HELP
          </span>
          <button
            onClick={onClose}
            className="text-terminal-white hover:text-terminal-red transition-colors font-mono text-sm px-1"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        <div className="p-4 font-mono text-xs space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Controls */}
          <div>
            <div className="text-terminal-green terminal-glow font-bold mb-2">
              CONTROLS
            </div>
            <div className="space-y-0.5">
              {CONTROLS.map((c) => (
                <div key={c.keys} className="flex gap-2">
                  <span className="text-terminal-green w-16 shrink-0 text-right">
                    {c.keys}
                  </span>
                  <span className="text-terminal-green-dim">{c.action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Combat */}
          <div>
            <div className="text-terminal-green terminal-glow font-bold mb-2">
              COMBAT
            </div>
            <div className="space-y-0.5">
              {COMBAT_KEYS.map((c) => (
                <div key={c.keys} className="flex gap-2">
                  <span className="text-terminal-green w-16 shrink-0 text-right">
                    {c.keys}
                  </span>
                  <span className="text-terminal-green-dim">{c.action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <div className="text-terminal-green terminal-glow font-bold mb-2">
              GAME TIPS
            </div>
            <ul className="space-y-1 text-terminal-green-dim">
              {TIPS.map((tip) => (
                <li key={tip}>
                  <span className="text-terminal-green mr-1">-</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Close hint */}
          <div className="text-terminal-border text-center pt-2 border-t border-terminal-border">
            Press <span className="text-terminal-green">Esc</span> or{" "}
            <span className="text-terminal-green">[X]</span> to close
          </div>
        </div>
      </div>
    </div>
  );
}
