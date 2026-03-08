"use client";

import { cn } from "@/lib/utils";
import { useEffect, useCallback, useRef, useState } from "react";

interface ContextDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ContextDrawer({ open, onClose, title, children, className }: ContextDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

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

  // Reset drag when closed
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  // Mobile swipe-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - touchStartY.current;
    // Only allow dragging down
    if (delta > 0) {
      setDragY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    // Dismiss if dragged > 80px
    if (dragY > 80) {
      onClose();
    }
    setDragY(0);
  }, [dragY, onClose]);

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
          "inset-x-0 bottom-0 max-h-[60dvh] rounded-t-lg border-t pb-[env(safe-area-inset-bottom)]",
          "md:inset-x-auto md:bottom-auto",
          // Desktop: right panel
          "md:top-0 md:right-0 md:h-full md:w-[320px] md:max-h-none md:rounded-none md:border-l md:border-t-0",
          // Open/close
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full",
          className
        )}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        role="dialog"
        aria-modal={open}
        aria-label={title ?? "Context panel"}
      >
        {/* Drag handle (mobile) — swipe to dismiss */}
        <div
          className="md:hidden flex justify-center py-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
          <h2 className="font-mono text-sm text-white font-bold truncate">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white active:text-white text-lg leading-none cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">{children}</div>
      </div>
    </>
  );
}
