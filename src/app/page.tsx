"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText } from "@/components/terminal";

const ASCII_TITLE = `
 ███████╗██╗   ██╗██████╗ ███████╗
 ██╔════╝██║   ██║██╔══██╗██╔════╝
 ███████╗██║   ██║██║  ██║███████╗
 ╚════██║██║   ██║██║  ██║╚════██║
 ███████║╚██████╔╝██████╔╝███████║
 ╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝
`.trimStart();

const FEATURES = [
  "Procedurally generated dungeons",
  "Turn-based combat with initiative",
  "AI-driven NPCs and lore",
  "Companion system — recruit adventurers",
  "Shrines, potions, and enchanted gear",
  "Terminal-themed retro UI",
];

export default function LandingPage() {
  const router = useRouter();
  const [subtitleDone, setSubtitleDone] = useState(false);
  const [taglineDone, setTaglineDone] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Terminal title="SUDS v2" className="w-full max-w-2xl">
        <div className="flex flex-col items-center gap-6 py-8">
          {/* ASCII Art Title */}
          <pre className="text-terminal-green terminal-glow text-xs sm:text-sm leading-tight select-none">
            {ASCII_TITLE}
          </pre>

          {/* Subtitle with typing effect */}
          <div className="text-lg text-center">
            <TerminalText
              text="Single User Dungeons"
              speed={50}
              onComplete={() => setSubtitleDone(true)}
            />
          </div>

          {/* Tagline */}
          {subtitleDone && (
            <div className="text-sm text-terminal-green-dim text-center">
              <TerminalText
                text="A procedurally generated dungeon crawler for the terminal at heart"
                speed={25}
                onComplete={() => setTaglineDone(true)}
              />
            </div>
          )}

          {/* Features + Actions — appear after tagline */}
          {taglineDone && (
            <>
              {/* Feature list */}
              <div className="w-full max-w-md border border-terminal-border p-4 space-y-1">
                <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider mb-2">
                  Features
                </div>
                {FEATURES.map((feature) => (
                  <div key={feature} className="text-xs text-terminal-green-dim">
                    <span className="text-terminal-green mr-2">&gt;</span>
                    {feature}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <button
                  onClick={() => router.push("/login")}
                  className="flex-1 px-4 py-2 border-2 border-terminal-green text-terminal-green font-mono text-sm hover:bg-terminal-green/10 transition-colors terminal-glow"
                >
                  [ LOGIN ]
                </button>
                <button
                  onClick={() => router.push("/invite")}
                  className="flex-1 px-4 py-2 border border-terminal-amber text-terminal-amber font-mono text-sm hover:bg-terminal-amber/10 transition-colors"
                >
                  [ ENTER INVITE CODE ]
                </button>
              </div>

              {/* Waitlist hint */}
              <div className="text-xs text-terminal-border-bright text-center max-w-sm">
                SUDS is currently in closed alpha. Have an invite code? Enter it above.
                Want access? Join the waitlist by reaching out to the developer.
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-4 text-xs text-terminal-border-bright select-none">
            v2.0.0-alpha | Invite Only
          </div>
        </div>
      </Terminal>
    </div>
  );
}
