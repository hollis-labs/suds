"use client";

import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import type { GameState } from "@/lib/types";
import { useMemo } from "react";

interface ActionBarProps {
  onAction: (action: string) => void;
  screen: GameState["screen"];
  className?: string;
}

interface KeyHint {
  keys: string[];
  label: string;
  action: string;
}

const EXPLORING_HINTS: KeyHint[] = [
  { keys: ["W", "\u2191"], label: "North", action: "move_north" },
  { keys: ["S", "\u2193"], label: "South", action: "move_south" },
  { keys: ["D", "\u2192"], label: "East", action: "move_east" },
  { keys: ["A", "\u2190"], label: "West", action: "move_west" },
  { keys: ["X"], label: "Search", action: "search" },
  { keys: ["I"], label: "Inventory", action: "inventory" },
  { keys: ["C"], label: "Character", action: "character" },
  { keys: ["?"], label: "Help", action: "help" },
];

const COMBAT_HINTS: KeyHint[] = [
  { keys: ["1"], label: "Attack", action: "attack" },
  { keys: ["2"], label: "Defend", action: "defend" },
  { keys: ["3"], label: "Cast", action: "cast" },
  { keys: ["4"], label: "Flee", action: "flee" },
  { keys: ["5"], label: "Use Item", action: "use_item" },
];

function getHints(screen: GameState["screen"]): KeyHint[] {
  switch (screen) {
    case "combat":
      return COMBAT_HINTS;
    case "exploring":
    default:
      return EXPLORING_HINTS;
  }
}

export function ActionBar({ onAction, screen, className }: ActionBarProps) {
  const hints = getHints(screen);

  const keyboardHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    if (screen === "exploring") {
      handlers["w"] = () => onAction("move_north");
      handlers["W"] = () => onAction("move_north");
      handlers["ArrowUp"] = () => onAction("move_north");
      handlers["s"] = () => onAction("move_south");
      handlers["S"] = () => onAction("move_south");
      handlers["ArrowDown"] = () => onAction("move_south");
      handlers["d"] = () => onAction("move_east");
      handlers["D"] = () => onAction("move_east");
      handlers["ArrowRight"] = () => onAction("move_east");
      handlers["a"] = () => onAction("move_west");
      handlers["A"] = () => onAction("move_west");
      handlers["ArrowLeft"] = () => onAction("move_west");
      handlers["x"] = () => onAction("search");
      handlers["X"] = () => onAction("search");
      handlers["i"] = () => onAction("inventory");
      handlers["I"] = () => onAction("inventory");
      handlers["c"] = () => onAction("character");
      handlers["C"] = () => onAction("character");
      handlers["?"] = () => onAction("help");
    } else if (screen === "combat") {
      handlers["1"] = () => onAction("attack");
      handlers["2"] = () => onAction("defend");
      handlers["3"] = () => onAction("cast");
      handlers["4"] = () => onAction("flee");
      handlers["5"] = () => onAction("use_item");
    }

    return handlers;
  }, [screen, onAction]);

  useKeyboard(keyboardHandlers);

  return (
    <div
      className={cn(
        "font-mono text-xs flex items-center gap-3 flex-wrap",
        className
      )}
    >
      {hints.map((hint) => (
        <button
          key={hint.action}
          onClick={() => onAction(hint.action)}
          className="text-terminal-green-dim hover:text-terminal-green transition-colors"
        >
          <span className="text-terminal-green">
            [{hint.keys.join("/")}]
          </span>{" "}
          {hint.label}
        </button>
      ))}
    </div>
  );
}
