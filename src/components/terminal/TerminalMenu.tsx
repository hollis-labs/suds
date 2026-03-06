"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface MenuOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface TerminalMenuProps {
  options: MenuOption[];
  onSelect: (value: string) => void;
  className?: string;
}

export function TerminalMenu({ options, onSelect, className }: TerminalMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectOption = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && !option.disabled) {
        onSelect(option.value);
      }
    },
    [options, onSelect]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => {
            let next = prev - 1;
            if (next < 0) next = options.length - 1;
            while (options[next]?.disabled && next !== prev) {
              next--;
              if (next < 0) next = options.length - 1;
            }
            return next;
          });
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => {
            let next = prev + 1;
            if (next >= options.length) next = 0;
            while (options[next]?.disabled && next !== prev) {
              next++;
              if (next >= options.length) next = 0;
            }
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          selectOption(selectedIndex);
          break;
        default: {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= options.length) {
            e.preventDefault();
            const index = num - 1;
            if (!options[index]?.disabled) {
              setSelectedIndex(index);
              selectOption(index);
            }
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [options, selectedIndex, selectOption]);

  return (
    <div className={cn("flex flex-col gap-1 font-mono", className)} role="menu">
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = option.disabled;

        return (
          <button
            key={option.value}
            role="menuitem"
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) {
                setSelectedIndex(index);
                selectOption(index);
              }
            }}
            onMouseEnter={() => {
              if (!isDisabled) setSelectedIndex(index);
            }}
            className={cn(
              "text-left px-2 py-0.5 transition-colors",
              isSelected && !isDisabled && "text-terminal-green terminal-glow bg-terminal-green/5",
              !isSelected && !isDisabled && "text-terminal-green-dim",
              isDisabled && "text-terminal-border opacity-50 cursor-not-allowed"
            )}
          >
            <span className="inline-block w-5">
              {isSelected ? ">" : " "}
            </span>
            [{index + 1}] {option.label}
          </button>
        );
      })}
    </div>
  );
}
