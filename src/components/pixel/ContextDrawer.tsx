"use client";

import { cn } from "@/lib/utils";
import { useEffect, useCallback, useRef } from "react";

interface ContextDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ContextDrawer({ open, onClose, title, children, className }: ContextDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          // Base
          "fixed z-50 bg-gray-900 border-gray-700 overflow-y-auto",
          "transition-transform duration-300 ease-in-out",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[70vh] rounded-t-lg border-t",
          "md:inset-x-auto md:bottom-auto",
          // Desktop: right panel
          "md:top-0 md:right-0 md:h-full md:w-[320px] md:max-h-none md:rounded-none md:border-l md:border-t-0",
          // Open/close
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full",
          className
        )}
        role="dialog"
        aria-modal={open}
        aria-label={title ?? "Context panel"}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
          {/* Mobile drag handle */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gray-600 md:hidden" />

          <h2 className="font-mono text-sm text-white font-bold truncate mt-1 md:mt-0">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-1 cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
