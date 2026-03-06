"use client";

import { cn } from "@/lib/utils";

interface TerminalProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Terminal({ children, title = "SUDS v2", className }: TerminalProps) {
  return (
    <div
      className={cn(
        "flex flex-col border border-terminal-border rounded-sm bg-terminal-bg",
        "shadow-[inset_0_0_30px_rgba(51,255,51,0.03)]",
        className
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-border bg-terminal-bg-alt">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-terminal-red opacity-80" />
          <span className="w-2.5 h-2.5 rounded-full bg-terminal-amber opacity-80" />
          <span className="w-2.5 h-2.5 rounded-full bg-terminal-green-dim opacity-80" />
        </div>
        <span className="flex-1 text-center text-xs text-terminal-white opacity-60 select-none">
          {title}
        </span>
        <div className="w-[52px]" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">{children}</div>
    </div>
  );
}
