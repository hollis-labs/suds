"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Terminal, TerminalText, TerminalMenu } from "@/components/terminal";
import { trpc } from "@/lib/trpc";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/characters";

  const { data: session, isLoading } = trpc.auth.getSession.useQuery();

  useEffect(() => {
    if (session?.user) {
      router.replace(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  if (isLoading) {
    return (
      <Terminal title="ACCESS TERMINAL" className="w-full max-w-md">
        <TerminalText text="Establishing connection..." className="text-terminal-green-dim" />
      </Terminal>
    );
  }

  if (session?.user) {
    return null;
  }

  const providers = [
    { label: "Google Authentication", value: "google" },
    { label: "GitHub Authentication", value: "github" },
    { label: "Discord Authentication", value: "discord" },
  ];

  function handleProviderSelect(provider: string) {
    signIn(provider, { callbackUrl });
  }

  return (
    <Terminal title="ACCESS TERMINAL" className="w-full max-w-md">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-lg text-terminal-green terminal-glow font-bold">
            ACCESS TERMINAL
          </h1>
          <TerminalText
            text="Authentication required. Select provider."
            speed={25}
            className="text-terminal-green-dim text-sm"
          />
        </div>

        <div className="border-t border-terminal-border pt-4">
          <TerminalMenu options={providers} onSelect={handleProviderSelect} />
        </div>

        <div className="border-t border-terminal-border pt-4">
          <p className="text-terminal-green-dim text-xs">
            New recruit? You&apos;ll need an{" "}
            <button
              onClick={() => router.push("/invite")}
              className="text-terminal-amber underline hover:text-terminal-green transition-colors"
            >
              invite code
            </button>
            .
          </p>
        </div>
      </div>
    </Terminal>
  );
}
