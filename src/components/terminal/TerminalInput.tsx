"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TerminalInputProps {
  prompt?: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TerminalInput({
  prompt = ">",
  onSubmit,
  placeholder,
  className,
  disabled = false,
}: TerminalInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono",
        disabled && "opacity-50",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <span className="text-terminal-green terminal-glow select-none shrink-0">
        {prompt}
      </span>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full bg-transparent text-terminal-green outline-none border-none",
            "caret-terminal-green placeholder:text-terminal-border-bright",
            "font-mono"
          )}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          if (value.trim()) {
            onSubmit(value.trim());
            setValue("");
          }
        }}
        disabled={disabled || !value.trim()}
        className={cn(
          "shrink-0 px-3 py-1 border text-xs font-mono transition-colors",
          value.trim()
            ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
            : "border-terminal-border text-terminal-border cursor-not-allowed"
        )}
      >
        Enter
      </button>
    </div>
  );
}
