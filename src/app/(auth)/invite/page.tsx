"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText, TerminalInput } from "@/components/terminal";
import { trpc } from "@/lib/trpc";

export default function InvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const autoRedeemAttempted = useRef(false);

  const { data: session } = trpc.auth.getSession.useQuery();
  const utils = trpc.useUtils();
  const redeemMutation = trpc.auth.redeemInvite.useMutation();

  // Auto-redeem if user is logged in and has a stored invite code
  useEffect(() => {
    if (!session?.user || autoRedeemAttempted.current || success) return;
    const storedCode = localStorage.getItem("suds_invite_code");
    if (!storedCode) return;

    autoRedeemAttempted.current = true;
    handleSubmit(storedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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

      // If already logged in, redeem immediately
      if (session?.user) {
        const redeemResult = await redeemMutation.mutateAsync({ code });
        if (!redeemResult.success) {
          setError(redeemResult.reason ?? "Failed to redeem invite");
          return;
        }
        setSuccess(true);
        setTimeout(() => {
          router.push("/characters");
        }, 1500);
        return;
      }

      // Not logged in — redirect to login
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
                text={session?.user ? "Entering the dungeon..." : "Redirecting to authentication..."}
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
              />
              {error && (
                <p className="text-terminal-red text-sm">
                  ERROR: {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-terminal-border pt-4 flex gap-4">
          <button
            onClick={() => router.push("/login")}
            className="text-terminal-green-dim text-xs hover:text-terminal-green transition-colors"
          >
            &lt; Login
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-terminal-green-dim text-xs hover:text-terminal-green transition-colors"
          >
            &lt; Home
          </button>
        </div>
      </div>
    </Terminal>
  );
}
