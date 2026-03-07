"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TerminalModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function TerminalModal({
  open,
  onClose,
  title,
  children,
  className,
}: TerminalModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector =
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modal.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full max-w-lg",
          "border-2 border-terminal-border bg-terminal-bg",
          "shadow-[0_0_20px_rgba(51,255,51,0.1)]",
          className
        )}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-bg-alt">
          <span className="text-sm text-terminal-green terminal-glow select-none">
            {title}
          </span>
          <button
            onClick={onClose}
            className="text-terminal-white hover:text-terminal-red transition-colors font-mono text-sm px-1"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}
