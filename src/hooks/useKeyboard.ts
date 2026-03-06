"use client";

import { useEffect } from "react";

/**
 * Hook that listens for keydown events and dispatches to handler functions.
 *
 * @param handlers - Map of key names to handler functions.
 *   Supports: "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
 *   "w", "a", "s", "d", "1"-"9", any single letter, "Enter", "Escape", etc.
 * @param enabled - Whether the listener is active (default true).
 *   Set to false when modals are open or input is focused.
 */
export function useKeyboard(
  handlers: Record<string, () => void>,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key;
      const handler = handlers[key];

      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlers, enabled]);
}
