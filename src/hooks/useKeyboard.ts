"use client";

import { useEffect, useRef } from "react";

/**
 * Hook that listens for keydown events and dispatches to handler functions.
 *
 * Uses a ref internally so the document listener is registered once and stays
 * stable — handler identity changes won't cause listener churn that drops events.
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

  // Keep refs up to date without re-registering the listener
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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

      // Don't intercept when modifier keys are held (e.g. Cmd+C for copy)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
