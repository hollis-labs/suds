import { cn } from "@/lib/utils";

interface TerminalHUDProps {
  children: React.ReactNode;
  topBar?: React.ReactNode;
  bottomBar?: React.ReactNode;
  className?: string;
}

export function TerminalHUD({
  children,
  topBar,
  bottomBar,
  className,
}: TerminalHUDProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full border border-terminal-border bg-terminal-bg",
        className
      )}
    >
      {/* Top bar */}
      {topBar && (
        <div className="shrink-0 px-3 py-1.5 border-b border-terminal-border bg-terminal-bg-alt text-sm">
          {topBar}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">{children}</div>

      {/* Bottom bar */}
      {bottomBar && (
        <div className="shrink-0 px-3 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] border-t border-terminal-border bg-terminal-bg-alt text-sm text-terminal-white opacity-60">
          {bottomBar}
        </div>
      )}
    </div>
  );
}
