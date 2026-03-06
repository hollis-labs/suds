"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TerminalThemeSelectorProps {
  className?: string;
}

const THEMES = [
  { id: "green", label: "Green Phosphor" },
  { id: "amber", label: "Amber CRT" },
  { id: "white", label: "White Terminal" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "suds-terminal-theme";

function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "green";
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) || "green";
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function TerminalThemeSelector({
  className,
}: TerminalThemeSelectorProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("green");

  useEffect(() => {
    const stored = getStoredTheme();
    setCurrentTheme(stored);
    applyTheme(stored);
  }, []);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEMES.findIndex((t) => t.id === currentTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    const next = THEMES[nextIndex].id;

    setCurrentTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [currentTheme]);

  const currentLabel =
    THEMES.find((t) => t.id === currentTheme)?.label ?? "Green Phosphor";

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "font-mono text-xs text-terminal-green-dim hover:text-terminal-green transition-colors",
        className
      )}
      title={`Theme: ${currentLabel} (click to cycle)`}
    >
      <span className="text-terminal-green">[T]</span> {currentLabel}
    </button>
  );
}
