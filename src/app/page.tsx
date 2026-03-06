"use client";

import { useState } from "react";
import { Terminal, TerminalText, TerminalMenu } from "@/components/terminal";

const ASCII_TITLE = `
 ███████╗██╗   ██╗██████╗ ███████╗
 ██╔════╝██║   ██║██╔══██╗██╔════╝
 ███████╗██║   ██║██║  ██║███████╗
 ╚════██║██║   ██║██║  ██║╚════██║
 ███████║╚██████╔╝██████╔╝███████║
 ╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝
`.trimStart();

const LOGIN_OPTIONS = [
  { label: "Login with Google", value: "google" },
  { label: "Login with GitHub", value: "github" },
  { label: "Login with Discord", value: "discord" },
];

export default function LandingPage() {
  const [subtitleDone, setSubtitleDone] = useState(false);
  const [taglineDone, setTaglineDone] = useState(false);

  function handleSelect(value: string) {
    // Auth integration comes later
    console.log(`Selected login: ${value}`);
  }

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
                text="A procedurally generated dungeon crawler"
                speed={25}
                onComplete={() => setTaglineDone(true)}
              />
            </div>
          )}

          {/* Menu */}
          {taglineDone && (
            <div className="mt-4 w-full max-w-xs">
              <TerminalMenu options={LOGIN_OPTIONS} onSelect={handleSelect} />
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-xs text-terminal-border-bright select-none">
            v2.0.0-alpha | Invite Only
          </div>
        </div>
      </Terminal>
    </div>
  );
}
