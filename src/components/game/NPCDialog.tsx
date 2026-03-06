"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalText } from "@/components/terminal";
import type { NPC, DialogueNode } from "@/lib/types";

interface NPCDialogProps {
  npc: NPC;
  currentNode: DialogueNode;
  onChoice: (choiceIndex: number) => void;
  onClose: () => void;
  className?: string;
}

interface HistoryEntry {
  speaker: "npc" | "player";
  text: string;
}

// ── Main Component ───────────────────────────────────────────────────

export function NPCDialog({
  npc,
  currentNode,
  onChoice,
  onClose,
  className,
}: NPCDialogProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showDescription, setShowDescription] = useState(true);
  const [typingComplete, setTypingComplete] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const prevNodeIdRef = useRef<string>(currentNode.id);

  // Track node changes to build conversation history
  useEffect(() => {
    if (currentNode.id !== prevNodeIdRef.current) {
      // Node changed — the previous node text was already in history
      // from handleChoice, just add the new NPC text
      setHistory((prev) => [
        ...prev,
        { speaker: "npc", text: currentNode.text },
      ]);
      setTypingComplete(false);
      prevNodeIdRef.current = currentNode.id;
    }
  }, [currentNode.id, currentNode.text]);

  // Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  // After first render, mark description as shown
  useEffect(() => {
    const timer = setTimeout(() => setShowDescription(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleChoice = useMemo(
    () => (choiceIndex: number) => {
      const choice = currentNode.choices[choiceIndex];
      if (!choice) return;

      // Add player's choice to history
      setHistory((prev) => [
        ...prev,
        { speaker: "player", text: choice.text },
      ]);

      // If choice leads to null nextId, close dialog
      if (choice.nextId === null) {
        onClose();
        return;
      }

      onChoice(choiceIndex);
    },
    [currentNode.choices, onChoice, onClose]
  );

  // ── Keyboard ──

  const keyboardHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    handlers["Escape"] = onClose;

    // Number keys for dialogue choices
    currentNode.choices.forEach((_, i) => {
      handlers[String(i + 1)] = () => handleChoice(i);
    });

    return handlers;
  }, [currentNode.choices, handleChoice, onClose]);

  useKeyboard(keyboardHandlers);

  // ── Render ──

  return (
    <div className={cn("font-mono text-sm space-y-3", className)}>
      {/* NPC Name */}
      <div className="text-terminal-amber terminal-glow font-bold text-center">
        {npc.name}
      </div>

      {/* NPC Description (shown initially) */}
      {showDescription && npc.description && (
        <div className="text-terminal-border-bright text-xs italic text-center">
          {npc.description}
        </div>
      )}

      {/* Conversation history (scrollable, dimmed) */}
      {history.length > 0 && (
        <div className="max-h-[120px] overflow-y-auto border border-terminal-border p-2 space-y-1">
          {history.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "text-xs",
                entry.speaker === "npc"
                  ? "text-terminal-amber/50"
                  : "text-terminal-green-dim/50"
              )}
            >
              <span className="font-bold">
                {entry.speaker === "npc" ? npc.name : "You"}:
              </span>{" "}
              {entry.text}
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}

      {/* Current dialogue text with typing effect */}
      <div className="border border-terminal-border p-3">
        <div className="text-xs text-terminal-amber-dim mb-1 font-bold">
          {npc.name} says:
        </div>
        <div className="text-terminal-amber text-xs leading-relaxed">
          <TerminalText
            text={currentNode.text}
            speed={25}
            animate={!typingComplete}
            onComplete={() => setTypingComplete(true)}
          />
        </div>
      </div>

      {/* Dialogue choices */}
      <div className="space-y-0.5">
        <div className="text-[10px] text-terminal-border-bright uppercase tracking-wider mb-1">
          Respond:
        </div>
        {currentNode.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleChoice(i)}
            className={cn(
              "block text-left text-xs px-1 py-0.5 transition-colors w-full",
              "text-terminal-green hover:bg-terminal-green/5 hover:terminal-glow"
            )}
          >
            <span className="text-terminal-green">[{i + 1}]</span>{" "}
            {choice.text}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-terminal-border pt-1 text-[10px] text-terminal-border-bright text-center">
        [Esc] Leave Conversation
      </div>
    </div>
  );
}
