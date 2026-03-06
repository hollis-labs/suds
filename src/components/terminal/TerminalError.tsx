"use client";

import { cn } from "@/lib/utils";

interface TerminalErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function TerminalError({
  message,
  onRetry,
  className,
}: TerminalErrorProps) {
  return (
    <div
      className={cn("font-mono text-sm", className)}
      role="alert"
    >
      <span className="text-terminal-red font-bold">ERROR:</span>{" "}
      <span className="text-terminal-red">{message}</span>
      {onRetry && (
        <div className="mt-2">
          <button
            onClick={onRetry}
            className="text-terminal-green-dim hover:text-terminal-green transition-colors"
          >
            <span className="text-terminal-green">[R]</span> Retry
          </button>
        </div>
      )}
    </div>
  );
}
