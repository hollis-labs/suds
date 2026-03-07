"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { trpc } from "@/lib/trpc";

interface NewsPanelProps {
  onClose: () => void;
  className?: string;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  update: { label: "UPDATE", color: "text-terminal-green bg-terminal-green/10 border-terminal-green/30" },
  event: { label: "EVENT", color: "text-terminal-amber bg-terminal-amber/10 border-terminal-amber/30" },
  bugfix: { label: "BUGFIX", color: "text-terminal-red bg-terminal-red/10 border-terminal-red/30" },
  announcement: { label: "ANNOUNCE", color: "text-terminal-blue bg-terminal-blue/10 border-terminal-blue/30" },
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function NewsPanel({ onClose, className }: NewsPanelProps) {
  const [selectedPost, setSelectedPost] = useState<number | null>(null);

  const newsQuery = trpc.news.list.useQuery();

  useKeyboard({
    Escape: onClose,
  });

  const posts = newsQuery.data ?? [];

  return (
    <div
      className={cn(
        "flex flex-col h-full font-mono text-xs",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-terminal-border pb-1 mb-2">
        <span className="text-terminal-green terminal-glow font-bold text-sm">
          NEWS
        </span>
        <button
          onClick={onClose}
          className="text-terminal-border-bright hover:text-terminal-red transition-colors"
        >
          [Esc] Close
        </button>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto min-h-0 terminal-scrollbar">
        {newsQuery.isLoading ? (
          <div className="text-terminal-border-bright animate-pulse">
            Loading news...
          </div>
        ) : posts.length === 0 ? (
          <div className="text-terminal-border-bright italic">
            No news to report. Check back later, adventurer.
          </div>
        ) : (
          <div className="space-y-1">
            {posts.map((post, i) => {
              const cat = CATEGORY_STYLES[post.category] ?? CATEGORY_STYLES.update;
              return (
                <div key={post.id}>
                  <button
                    onClick={() =>
                      setSelectedPost(selectedPost === i ? null : i)
                    }
                    className={cn(
                      "w-full text-left px-2 py-1.5 transition-colors",
                      selectedPost === i
                        ? "bg-terminal-green/10 text-terminal-green"
                        : "text-terminal-green-dim hover:bg-terminal-green/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 border font-bold tracking-wider",
                          cat.color
                        )}
                      >
                        {cat.label}
                      </span>
                      <span className="font-bold flex-1">{post.title}</span>
                      <span className="text-terminal-border-bright text-[10px] shrink-0">
                        {formatDate(post.createdAt!)}
                      </span>
                    </div>
                  </button>
                  {selectedPost === i && (
                    <div className="px-4 py-2 text-terminal-green-dim leading-relaxed border-l-2 border-terminal-green/20 ml-2 whitespace-pre-wrap">
                      {post.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
