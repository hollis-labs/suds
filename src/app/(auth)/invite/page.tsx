"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText, TerminalInput } from "@/components/terminal";
import { trpc } from "@/lib/trpc";

export default function InvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateInvite = trpc.auth.validateInvite.useQuery(
    { code: "" },
    { enabled: false }
  );

  const utils = trpc.useUtils();

  async function handleSubmit(code: string) {
    setError(null);

    try {
      const result = await utils.auth.validateInvite.fetch({ code });

      if (!result.valid) {
        setError(result.reason);
        return;
      }

      // Store the validated invite code for use during registration
      localStorage.setItem("suds_invite_code", code);
      setSuccess(true);

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch {
      setError("Failed to validate invite code. Try again.");
    }
  }

  return (
    <Terminal title="SECURITY CLEARANCE" className="w-full max-w-md">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-lg text-terminal-green terminal-glow font-bold">
            SECURITY CLEARANCE
          </h1>
          <TerminalText
            text="Enter your invite code to proceed."
            speed={25}
            className="text-terminal-green-dim text-sm"
          />
        </div>

        <div className="border-t border-terminal-border pt-4">
          {success ? (
            <div className="space-y-2">
              <p className="text-terminal-green terminal-glow">
                ACCESS GRANTED
              </p>
              <TerminalText
                text="Redirecting to authentication..."
                speed={20}
                className="text-terminal-green-dim text-sm"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <TerminalInput
                prompt="INVITE_CODE>"
                onSubmit={handleSubmit}
                placeholder="Enter code..."
                disabled={validateInvite.isFetching}
              />
              {error && (
                <p className="text-terminal-red text-sm">
                  ERROR: {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-terminal-border pt-4">
          <button
            onClick={() => router.push("/login")}
            className="text-terminal-green-dim text-xs hover:text-terminal-green transition-colors"
          >
            &lt; Back to login
          </button>
        </div>
      </div>
    </Terminal>
  );
}
