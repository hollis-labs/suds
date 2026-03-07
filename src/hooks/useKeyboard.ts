"use client";

import { useEffect, useRef } from "react";

/**
 * Hook that listens for keydown events and dispatches to handler functions.
 *
 * Uses a ref internally so the document listener is registered once and stays
 * stable — handler identity changes won't cause listener churn that drops events.
 *
 * Refs are updated synchronously during render (not in useEffect) so there is
 * never a stale-handler window between render and effect commit.
 *
 * @param handlers - Map of key names to handler functions.
 * @param enabled - Whether the listener is active (default true).
 */
export function useKeyboard(
  handlers: Record<string, () => void>,
  enabled: boolean = true
): void {
  const handlersRef = useRef(handlers);
  const enabledRef = useRef(enabled);

  // Synchronously update refs during render — no stale-handler gap
  handlersRef.current = handlers;
  enabledRef.current = enabled;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return;

      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't intercept Ctrl/Alt combos (e.g. Ctrl+C for copy)
      // Note: e.metaKey intentionally NOT checked — Karabiner Elements
      // and similar tools can leave Meta in a phantom/stuck state.
      if (e.ctrlKey || e.altKey) return;
      if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") return;

      const key = e.key;
      const handler = handlersRef.current[key];

      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []); // Register once, never re-register
}
