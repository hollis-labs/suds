"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const CONTENT_TYPES = [
  "room_description",
  "npc_dialogue",
  "lore_fragment",
  "quest",
];
const THEMES = ["horror", "funny", "epic", "dark_fantasy"];

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "unknown";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function qualityStars(quality: number): string {
  return "\u2605".repeat(quality) + "\u2606".repeat(5 - quality);
}

function contentPreview(content: unknown): string {
  if (typeof content === "string") {
    return content.length > 80 ? content.slice(0, 80) + "..." : content;
  }
  const str = JSON.stringify(content);
  return str.length > 80 ? str.slice(0, 80) + "..." : str;
}

function contentFull(content: unknown): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 2);
}

export function AdminContentLibrary({ isAdmin }: { isAdmin: boolean }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editQuality, setEditQuality] = useState(3);
  const [editTheme, setEditTheme] = useState("");
  const [editTags, setEditTags] = useState("");
  const pageSize = 50;

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState(CONTENT_TYPES[0]);
  const [createTheme, setCreateTheme] = useState(THEMES[0]);
  const [createContent, setCreateContent] = useState("");
  const [createQuality, setCreateQuality] = useState(3);
  const [createTags, setCreateTags] = useState("");

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const contentQuery = trpc.admin.getContentLibrary.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      typeFilter: typeFilter || undefined,
      themeFilter: themeFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const utils = trpc.useUtils();
  const updateMutation = trpc.admin.updateContentEntry.useMutation({
    onSuccess: () => {
      void utils.admin.getContentLibrary.invalidate();
      setEditingId(null);
    },
  });

  const createMutation = trpc.admin.createContentEntry.useMutation({
    onSuccess: () => {
      void utils.admin.getContentLibrary.invalidate();
      setShowCreateForm(false);
      setCreateType(CONTENT_TYPES[0]);
      setCreateTheme(THEMES[0]);
      setCreateContent("");
      setCreateQuality(3);
      setCreateTags("");
      setFeedback({ type: "success", message: "Entry created successfully." });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: `Create failed: ${err.message}` });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const deleteMutation = trpc.admin.deleteContentEntry.useMutation({
    onSuccess: () => {
      void utils.admin.getContentLibrary.invalidate();
      setConfirmDeleteId(null);
      if (expandedId) setExpandedId(null);
      setFeedback({ type: "success", message: "Entry deleted." });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: `Delete failed: ${err.message}` });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const bulkDeleteMutation = trpc.admin.bulkDeleteContentEntries.useMutation({
    onSuccess: (_data, variables) => {
      void utils.admin.getContentLibrary.invalidate();
      setFeedback({ type: "success", message: `Bulk deleted ${variables.ids.length} low-quality entries.` });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: `Bulk delete failed: ${err.message}` });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const entries = contentQuery.data?.entries ?? [];
  const total = contentQuery.data?.total ?? 0;
  const summary = contentQuery.data?.summary ?? [];
  const totalPages = Math.ceil(total / pageSize);

  // Compute summary stats
  const typeCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  let totalQuality = 0;
  let qualityCount = 0;
  for (const s of summary) {
    typeCounts[s.type] = (typeCounts[s.type] ?? 0) + s.count;
    themeCounts[s.theme] = (themeCounts[s.theme] ?? 0) + s.count;
    if (s.avgQuality != null) {
      totalQuality += s.avgQuality * s.count;
      qualityCount += s.count;
    }
  }
  const avgQuality =
    qualityCount > 0 ? (totalQuality / qualityCount).toFixed(1) : "--";
  const totalEntries = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  function startEditing(entry: (typeof entries)[number]) {
    setEditingId(entry.id);
    setEditContent(contentFull(entry.content));
    setEditQuality(entry.quality);
    setEditTheme(entry.theme ?? "");
    setEditTags(
      Array.isArray((entry as Record<string, unknown>).tags)
        ? ((entry as Record<string, unknown>).tags as string[]).join(", ")
        : ""
    );
  }

  function handleSave(entry: (typeof entries)[number]) {
    const isObjectContent =
      typeof entry.content === "object" && entry.content !== null;
    let parsedContent: unknown = editContent;
    if (isObjectContent) {
      try {
        parsedContent = JSON.parse(editContent);
      } catch {
        // If JSON parse fails, send as string
        parsedContent = editContent;
      }
    }
    updateMutation.mutate({
      id: entry.id,
      content: parsedContent,
      quality: editQuality,
      theme: editTheme || undefined,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  function handleCreate() {
    if (!createContent.trim()) return;
    createMutation.mutate({
      type: createType,
      theme: createTheme,
      content: createContent,
      quality: createQuality,
      tags: createTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  function handleBulkDeleteLowQuality() {
    const lowQualityIds = entries.filter((e) => e.quality <= 1).map((e) => e.id);
    if (lowQualityIds.length === 0) return;
    bulkDeleteMutation.mutate({ ids: lowQualityIds });
  }

  const lowQualityCount = entries.filter((e) => e.quality <= 1).length;

  return (
    <div className="space-y-4">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`px-3 py-2 text-xs border ${
            feedback.type === "success"
              ? "border-terminal-green text-terminal-green bg-terminal-green/5"
              : "border-red-500 text-red-500 bg-red-500/5"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Summary Panel */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== CONTENT LIBRARY ===</h2>
        <div className="pl-2 mb-3 text-xs space-y-1">
          <p>
            <span className="text-terminal-dim">Total entries: </span>
            <span className="text-terminal-green-bright">{totalEntries}</span>
            <span className="text-terminal-dim ml-3">Avg quality: </span>
            <span className="text-terminal-amber">{avgQuality}</span>
          </p>
          <div className="flex flex-wrap gap-x-4">
            <span className="text-terminal-dim">By type:</span>
            {Object.entries(typeCounts).map(([type, cnt]) => (
              <span key={type}>
                <span className="text-terminal-green">{type}</span>
                <span className="text-terminal-dim">: {cnt}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4">
            <span className="text-terminal-dim">By theme:</span>
            {Object.entries(themeCounts).map(([theme, cnt]) => (
              <span key={theme}>
                <span className="text-terminal-amber">{theme}</span>
                <span className="text-terminal-dim">: {cnt}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Filters */}
      <div className="pl-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <label className="text-terminal-dim text-xs">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(0);
            }}
            className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
          >
            <option value="">All</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-terminal-dim text-xs">Theme:</label>
          <select
            value={themeFilter}
            onChange={(e) => {
              setThemeFilter(e.target.value);
              setPage(0);
            }}
            className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
          >
            <option value="">All</option>
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <span className="text-terminal-dim text-xs">
          Showing {entries.length} of {total}
        </span>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-terminal-green hover:text-terminal-green-bright border border-terminal-border px-2 py-0.5 text-xs"
        >
          {showCreateForm ? "[CANCEL CREATE]" : "[CREATE ENTRY]"}
        </button>

        {lowQualityCount > 0 && (
          <button
            onClick={handleBulkDeleteLowQuality}
            disabled={bulkDeleteMutation.isPending}
            className="text-red-500 hover:text-red-400 border border-terminal-border px-2 py-0.5 text-xs disabled:text-terminal-dim"
          >
            {bulkDeleteMutation.isPending
              ? "[DELETING...]"
              : `[BULK DELETE LOW QUALITY (${lowQualityCount})]`}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="pl-2 mx-2 border border-terminal-border p-3 space-y-3">
          <p className="text-terminal-amber text-xs">NEW CONTENT ENTRY</p>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-terminal-dim text-xs block mb-1">Type:</label>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-terminal-dim text-xs block mb-1">Theme:</label>
              <select
                value={createTheme}
                onChange={(e) => setCreateTheme(e.target.value)}
                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-terminal-dim text-xs block mb-1">Content:</label>
            <textarea
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              rows={6}
              placeholder="Enter content text..."
              className="w-full bg-black border border-terminal-border text-terminal-green text-xs p-2 font-mono focus:outline-none focus:border-terminal-green resize-y"
            />
          </div>

          <div>
            <label className="text-terminal-dim text-xs block mb-1">Quality:</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  onClick={() => setCreateQuality(q)}
                  className={`px-2 py-0.5 text-xs border border-terminal-border ${
                    createQuality >= q
                      ? "text-terminal-amber bg-terminal-amber/10"
                      : "text-terminal-dim"
                  } hover:text-terminal-amber`}
                >
                  {"\u2605"}
                </button>
              ))}
              <span className="text-terminal-dim text-xs ml-2 self-center">{createQuality}/5</span>
            </div>
          </div>

          <div>
            <label className="text-terminal-dim text-xs block mb-1">Tags (comma-separated):</label>
            <input
              type="text"
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="e.g. dungeon, boss, treasure"
              className="w-full bg-black border border-terminal-border text-terminal-green text-xs px-2 py-1 font-mono focus:outline-none focus:border-terminal-green"
            />
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createContent.trim()}
              className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5 text-xs"
            >
              {createMutation.isPending ? "[CREATING...]" : "[CREATE]"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              disabled={createMutation.isPending}
              className="text-terminal-amber hover:text-terminal-amber/80 disabled:text-terminal-dim border border-terminal-border px-2 py-0.5 text-xs"
            >
              [CANCEL]
            </button>
            {createMutation.isError && (
              <span className="text-red-500 text-xs">
                Error: {createMutation.error.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {contentQuery.isLoading ? (
        <p className="text-terminal-dim">Loading...</p>
      ) : (
        <>
          <div className="pl-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-terminal-dim border-b border-terminal-border">
                  <th className="text-left py-1 pr-2">Type</th>
                  <th className="text-left py-1 pr-2">Theme</th>
                  <th className="text-left py-1 pr-2">Quality</th>
                  <th className="text-left py-1 pr-2">Used</th>
                  <th className="text-left py-1 pr-2">Content</th>
                  <th className="text-left py-1 pr-2">Created</th>
                  <th className="text-left py-1"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                    onClick={() =>
                      setExpandedId(
                        expandedId === entry.id ? null : entry.id
                      )
                    }
                  >
                    <td className="py-1 pr-2 text-terminal-green">
                      {entry.type}
                    </td>
                    <td className="py-1 pr-2 text-terminal-amber">
                      {entry.theme}
                    </td>
                    <td className="py-1 pr-2 text-terminal-amber">
                      {qualityStars(entry.quality)}
                    </td>
                    <td className="py-1 pr-2">{entry.usageCount}</td>
                    <td className="py-1 pr-2 text-terminal-dim max-w-sm truncate">
                      {contentPreview(entry.content)}
                    </td>
                    <td className="py-1 pr-2 text-terminal-dim">
                      {timeAgo(entry.createdAt)}
                    </td>
                    <td className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirmDeleteId === entry.id) {
                            deleteMutation.mutate({ id: entry.id });
                          } else {
                            setConfirmDeleteId(entry.id);
                          }
                        }}
                        disabled={deleteMutation.isPending && confirmDeleteId === entry.id}
                        className={`text-xs border border-terminal-border px-2 py-0.5 ${
                          confirmDeleteId === entry.id
                            ? "text-red-500 bg-red-500/10 hover:text-red-400"
                            : "text-terminal-dim hover:text-red-500"
                        } disabled:text-terminal-dim`}
                      >
                        {deleteMutation.isPending && confirmDeleteId === entry.id
                          ? "[...]"
                          : confirmDeleteId === entry.id
                          ? "[CONFIRM?]"
                          : "[DELETE]"}
                      </button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 text-terminal-dim">
                      No content entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expanded content (outside table to avoid layout issues) */}
          {expandedId &&
            (() => {
              const expandedEntry = entries.find(
                (e) => e.id === expandedId
              );
              if (!expandedEntry) return null;
              const isEditing = editingId === expandedId;

              return (
                <div className="pl-2 border border-terminal-border p-3 mx-2">
                  {isEditing ? (
                    <div className="space-y-3">
                      <p className="text-terminal-amber text-xs mb-1">
                        EDIT CONTENT
                      </p>

                      {/* Content textarea */}
                      <div>
                        <label className="text-terminal-dim text-xs block mb-1">
                          Content:
                        </label>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={8}
                          className="w-full bg-black border border-terminal-border text-terminal-green text-xs p-2 font-mono focus:outline-none focus:border-terminal-green resize-y"
                        />
                      </div>

                      {/* Quality selector */}
                      <div>
                        <label className="text-terminal-dim text-xs block mb-1">
                          Quality:
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((q) => (
                            <button
                              key={q}
                              onClick={() => setEditQuality(q)}
                              className={`px-2 py-0.5 text-xs border border-terminal-border ${
                                editQuality >= q
                                  ? "text-terminal-amber bg-terminal-amber/10"
                                  : "text-terminal-dim"
                              } hover:text-terminal-amber`}
                            >
                              {"\u2605"}
                            </button>
                          ))}
                          <span className="text-terminal-dim text-xs ml-2 self-center">
                            {editQuality}/5
                          </span>
                        </div>
                      </div>

                      {/* Theme dropdown */}
                      <div>
                        <label className="text-terminal-dim text-xs block mb-1">
                          Theme:
                        </label>
                        <select
                          value={editTheme}
                          onChange={(e) => setEditTheme(e.target.value)}
                          className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
                        >
                          <option value="">None</option>
                          {THEMES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tags input */}
                      <div>
                        <label className="text-terminal-dim text-xs block mb-1">
                          Tags (comma-separated):
                        </label>
                        <input
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="e.g. dungeon, boss, treasure"
                          className="w-full bg-black border border-terminal-border text-terminal-green text-xs px-2 py-1 font-mono focus:outline-none focus:border-terminal-green"
                        />
                      </div>

                      {/* Save / Cancel buttons */}
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleSave(expandedEntry)}
                          disabled={updateMutation.isPending}
                          className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5 text-xs"
                        >
                          {updateMutation.isPending
                            ? "[SAVING...]"
                            : "[SAVE]"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                          className="text-terminal-amber hover:text-terminal-amber/80 disabled:text-terminal-dim border border-terminal-border px-2 py-0.5 text-xs"
                        >
                          [CANCEL]
                        </button>
                        {updateMutation.isError && (
                          <span className="text-red-500 text-xs">
                            Error: {updateMutation.error.message}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-terminal-amber text-xs">
                          FULL CONTENT
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(expandedEntry);
                          }}
                          className="text-terminal-green hover:text-terminal-green-bright border border-terminal-border px-2 py-0.5 text-xs"
                        >
                          [EDIT]
                        </button>
                      </div>
                      <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">
                        {contentFull(expandedEntry.content)}
                      </pre>
                    </>
                  )}
                </div>
              );
            })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pl-2 mt-3 flex items-center gap-3 text-xs">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5"
              >
                [PREV]
              </button>
              <span className="text-terminal-dim">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5"
              >
                [NEXT]
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
