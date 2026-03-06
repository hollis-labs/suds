"use client";

import { Terminal, TerminalText } from "@/components/terminal";

export default function PlayPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Terminal title="SUDS v2 — DUNGEON" className="w-full max-w-2xl">
        <div className="space-y-6">
          <h1 className="text-lg text-terminal-green terminal-glow font-bold">
            ENTERING THE DUNGEON...
          </h1>

          <TerminalText
            text="World generation in progress. Sprint 3 will bring this to life."
            speed={30}
            className="text-terminal-green-dim text-sm"
          />

          <div className="border-t border-terminal-border pt-4 text-terminal-green-dim text-xs">
            <p>System ready. Awaiting implementation.</p>
          </div>
        </div>
      </Terminal>
    </div>
  );
}
