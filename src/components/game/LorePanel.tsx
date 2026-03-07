"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { trpc } from "@/lib/trpc";

interface LorePanelProps {
  characterId: string;
  onClose: () => void;
  className?: string;
}

type Tab = "lore" | "notes";

const SOURCE_ICONS: Record<string, string> = {
  room: "\u{1F3E0}",
  npc: "\u{1F5E3}",
  item: "\u{2728}",
  search: "\u{1F50D}",
  combat: "\u{2694}",
};

export function LorePanel({ characterId, onClose, className }: LorePanelProps) {
  const [tab, setTab] = useState<Tab>("lore");
  const [selectedLore, setSelectedLore] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const loreQuery = trpc.lore.list.useQuery({ characterId });
  const notesQuery = trpc.lore.notesList.useQuery({ characterId });
  const addNoteMutation = trpc.lore.notesAdd.useMutation({
    onSuccess: () => {
      setNoteInput("");
      notesQuery.refetch();
    },
  });
  const deleteNoteMutation = trpc.lore.notesDelete.useMutation({
    onSuccess: () => {
      notesQuery.refetch();
    },
  });

  const handleAddNote = useCallback(() => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    addNoteMutation.mutate({ characterId, content: trimmed });
  }, [noteInput, characterId, addNoteMutation]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      deleteNoteMutation.mutate({ characterId, noteId });
    },
    [characterId, deleteNoteMutation]
  );

  useKeyboard({
    Escape: onClose,
    "1": () => setTab("lore"),
    "2": () => setTab("notes"),
  });

  const loreEntries = loreQuery.data ?? [];
  const notes = notesQuery.data ?? [];

  return (
    <div
      className={cn(
        "flex flex-col h-full font-mono text-xs",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-terminal-border pb-1 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-terminal-green terminal-glow font-bold text-sm">
            CODEX
          </span>
          <button
            onClick={() => setTab("lore")}
            className={cn(
              "px-2 py-0.5 transition-colors",
              tab === "lore"
                ? "text-terminal-green bg-terminal-green/10"
                : "text-terminal-border-bright hover:text-terminal-green-dim"
            )}
          >
            [1] Lore ({loreEntries.length})
          </button>
          <button
            onClick={() => setTab("notes")}
            className={cn(
              "px-2 py-0.5 transition-colors",
              tab === "notes"
                ? "text-terminal-green bg-terminal-green/10"
                : "text-terminal-border-bright hover:text-terminal-green-dim"
            )}
          >
            [2] Notes ({notes.length})
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-terminal-border-bright hover:text-terminal-red transition-colors"
        >
          [Esc] Close
        </button>
      </div>

      {/* Lore Tab */}
      {tab === "lore" && (
        <div className="flex-1 overflow-y-auto min-h-0 terminal-scrollbar">
          {loreQuery.isLoading ? (
            <div className="text-terminal-border-bright animate-pulse">
              Loading codex...
            </div>
          ) : loreEntries.length === 0 ? (
            <div className="text-terminal-border-bright italic">
              No lore discovered yet. Explore the dungeon to uncover its secrets.
            </div>
          ) : (
            <div className="space-y-1">
              {loreEntries.map((entry, i) => (
                <div key={entry.id}>
                  <button
                    onClick={() =>
                      setSelectedLore(selectedLore === i ? null : i)
                    }
                    className={cn(
                      "w-full text-left px-2 py-1 transition-colors",
                      selectedLore === i
                        ? "bg-terminal-green/10 text-terminal-green"
                        : "text-terminal-green-dim hover:bg-terminal-green/5"
                    )}
                  >
                    <span className="mr-1.5">
                      {SOURCE_ICONS[entry.source] ?? "\u203A"}
                    </span>
                    <span className="font-bold">{entry.title}</span>
                    <span className="text-terminal-border-bright text-[10px] ml-2 uppercase">
                      {entry.source}
                    </span>
                  </button>
                  {selectedLore === i && (
                    <div className="px-4 py-2 text-terminal-green-dim leading-relaxed border-l-2 border-terminal-green/20 ml-2">
                      {entry.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {tab === "notes" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Note input */}
          <div className="shrink-0 flex gap-2 mb-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddNote();
                }
                e.stopPropagation();
              }}
              placeholder="Write a note..."
              maxLength={1000}
              className="flex-1 bg-terminal-bg border border-terminal-border text-terminal-green px-2 py-1 text-xs font-mono placeholder:text-terminal-border-bright focus:outline-none focus:border-terminal-green"
            />
            <button
              onClick={handleAddNote}
              disabled={!noteInput.trim() || addNoteMutation.isPending}
              className={cn(
                "px-3 py-1 border border-terminal-border transition-colors",
                noteInput.trim()
                  ? "text-terminal-green hover:bg-terminal-green/10"
                  : "text-terminal-border cursor-not-allowed"
              )}
            >
              Add
            </button>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto min-h-0 terminal-scrollbar">
            {notesQuery.isLoading ? (
              <div className="text-terminal-border-bright animate-pulse">
                Loading notes...
              </div>
            ) : notes.length === 0 ? (
              <div className="text-terminal-border-bright italic">
                No notes yet. Use the field above to jot down reminders.
              </div>
            ) : (
              <div className="space-y-1">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-2 px-2 py-1 text-terminal-green-dim group"
                  >
                    <span className="text-terminal-border">&gt;</span>
                    <span className="flex-1">{note.content}</span>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-terminal-border opacity-0 group-hover:opacity-100 hover:text-terminal-red transition-all text-[10px]"
                    >
                      [x]
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
