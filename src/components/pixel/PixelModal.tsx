"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SpriteIcon } from "./SpriteIcon";
import type { SpriteId } from "@/lib/sprites";

interface PixelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: SpriteId;
  className?: string;
  children: React.ReactNode;
}

export function PixelModal({
  open,
  onClose,
  title,
  icon,
  className,
  children,
}: PixelModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
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
          "border-2 border-gray-600 bg-gray-900/95 rounded-sm",
          "shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]",
          className
        )}
        style={{ imageRendering: "pixelated" }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-gray-600 bg-gray-800/80">
          <div className="flex items-center gap-2">
            {icon && <SpriteIcon spriteId={icon} size={18} />}
            <span className="font-mono text-sm text-gray-200 font-bold truncate">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors font-mono text-sm px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[85dvh]">{children}</div>
      </div>
    </div>
  );
}
