"use client";

import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";

interface AboutPanelProps {
  onClose: () => void;
  className?: string;
}

export function AboutPanel({ onClose, className }: AboutPanelProps) {
  useKeyboard({
    Escape: onClose,
  });

  return (
    <div
      className={cn(
        "flex flex-col h-full font-mono text-xs",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-terminal-border pb-1 mb-2">
        <span className="text-terminal-green terminal-glow font-bold text-sm">
          ABOUT
        </span>
        <button
          onClick={onClose}
          className="text-terminal-border-bright hover:text-terminal-red transition-colors"
        >
          [Esc] Close
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 terminal-scrollbar space-y-4">
        {/* Title */}
        <div className="text-center py-2">
          <div className="text-terminal-green terminal-glow font-bold text-lg tracking-wider">
            SUDS
          </div>
          <div className="text-terminal-green-dim text-[10px] uppercase tracking-widest mt-0.5">
            Single User Dungeon(s)
          </div>
          <div className="text-terminal-border-bright text-[10px] mt-1">
            v2.0-beta
          </div>
        </div>

        {/* Description */}
        <div className="border border-terminal-border p-3">
          <div className="text-terminal-green terminal-glow font-bold mb-1">
            ABOUT
          </div>
          <p className="text-terminal-green-dim leading-relaxed">
            A D&amp;D-inspired MUD reimagined for the modern web. AI-generated
            worlds, turn-based combat, and retro terminal aesthetics.
          </p>
        </div>

        {/* Report a Bug */}
        <div className="border border-terminal-border p-3">
          <div className="text-terminal-green terminal-glow font-bold mb-1">
            REPORT A BUG
          </div>
          <p className="text-terminal-green-dim mb-2">
            Found a bug? Encountered a glitch in the dungeon?
          </p>
          <a
            href="#"
            className="text-terminal-amber hover:text-terminal-amber/80 transition-colors"
          >
            &gt; Submit Bug Report
          </a>
        </div>

        {/* Credits */}
        <div className="border border-terminal-border p-3">
          <div className="text-terminal-green terminal-glow font-bold mb-1">
            CREDITS
          </div>
          <p className="text-terminal-green-dim">
            Built by Chrispian H. Burks
          </p>
        </div>

        {/* Links */}
        <div className="border border-terminal-border p-3">
          <div className="text-terminal-green terminal-glow font-bold mb-1">
            LINKS
          </div>
          <div className="space-y-1 text-terminal-green-dim">
            <a
              href="#"
              className="block hover:text-terminal-green transition-colors"
            >
              &gt; Website
            </a>
            <a
              href="#"
              className="block hover:text-terminal-green transition-colors"
            >
              &gt; Source Code
            </a>
          </div>
        </div>

        {/* Close hint */}
        <div className="text-terminal-border text-center pt-2 border-t border-terminal-border">
          Press <span className="text-terminal-green">Esc</span> to close
        </div>
      </div>
    </div>
  );
}
