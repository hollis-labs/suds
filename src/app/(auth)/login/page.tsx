"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Terminal, TerminalText, TerminalMenu, TerminalInput } from "@/components/terminal";
import { trpc } from "@/lib/trpc";

const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Terminal title="ACCESS TERMINAL" className="w-full max-w-md">
          <TerminalText text="Establishing connection..." className="text-terminal-green-dim" />
        </Terminal>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/characters";
  const [showDevLogin, setShowDevLogin] = useState(false);

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
    ...(isDevMode
      ? [{ label: "Dev Login (local only)", value: "dev" }]
      : []),
    { label: "Google Authentication", value: "google" },
    { label: "GitHub Authentication", value: "github" },
    { label: "Discord Authentication", value: "discord" },
  ];

  function handleProviderSelect(provider: string) {
    if (provider === "dev") {
      setShowDevLogin(true);
      return;
    }
    signIn(provider, { callbackUrl });
  }

  function handleDevLogin(email: string) {
    if (!email) return;
    signIn("credentials", { email, callbackUrl });
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

        {showDevLogin ? (
          <div className="border-t border-terminal-border pt-4 space-y-3">
            <p className="text-terminal-amber text-xs font-mono">
              DEV MODE — Enter any email to log in:
            </p>
            <TerminalInput
              prompt="EMAIL>"
              onSubmit={handleDevLogin}
              placeholder="dev@suds.local"
            />
            <button
              onClick={() => setShowDevLogin(false)}
              className="text-terminal-green-dim text-xs hover:text-terminal-green transition-colors"
            >
              &lt; Back to providers
            </button>
          </div>
        ) : (
          <div className="border-t border-terminal-border pt-4">
            <TerminalMenu options={providers} onSelect={handleProviderSelect} />
          </div>
        )}

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
