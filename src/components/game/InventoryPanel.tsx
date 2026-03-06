"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { RARITY } from "@/lib/constants";
import type { GameItem } from "@/lib/types";

interface InventoryPanelProps {
  items: GameItem[];
  maxSlots: number;
  onEquip: (itemId: string) => void;
  onUnequip: (itemId: string) => void;
  onUse: (itemId: string) => void;
  onDrop: (itemId: string) => void;
  onClose: () => void;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const GRID_COLUMNS = 4;

function rarityColor(rarity: GameItem["rarity"]): string {
  return RARITY[rarity]?.color ?? "text-terminal-white";
}

function itemTypeLabel(type: GameItem["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatStats(stats: Record<string, number>): string {
  return Object.entries(stats)
    .map(([k, v]) => `${k.toUpperCase()} +${v}`)
    .join(", ");
}

function isUsable(item: GameItem): boolean {
  return item.type === "potion" || item.type === "scroll";
}

function isEquippable(item: GameItem): boolean {
  return (
    item.type === "weapon" ||
    item.type === "armor" ||
    item.type === "accessory"
  );
}

// ── Grid Cell ────────────────────────────────────────────────────────

function InventoryCell({
  item,
  index,
  isSelected,
  onSelect,
}: {
  item: GameItem | null;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (!item) {
    return (
      <div
        className={cn(
          "border border-terminal-border px-2 py-1.5 text-xs min-h-[36px]",
          "text-terminal-border-bright",
          isSelected && "border-terminal-green bg-terminal-green/5"
        )}
      >
        <span className="text-terminal-border">[{index + 1}]</span>{" "}
        <span className="italic">(empty)</span>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        "block text-left border border-terminal-border px-2 py-1.5 text-xs w-full min-h-[36px] transition-colors",
        isSelected && "border-terminal-green bg-terminal-green/5 terminal-glow",
        !isSelected && "hover:border-terminal-green-dim"
      )}
    >
      <span className="text-terminal-green">[{index + 1}]</span>{" "}
      <span className={rarityColor(item.rarity)}>
        {item.name}
      </span>
      {item.isEquipped && (
        <span className="text-terminal-amber ml-0.5">*</span>
      )}
      {item.quantity > 1 && (
        <span className="text-terminal-border-bright ml-1">
          x{item.quantity}
        </span>
      )}
    </button>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────

function ItemDetailPanel({
  item,
  onEquip,
  onUnequip,
  onUse,
  onDrop,
}: {
  item: GameItem;
  onEquip: () => void;
  onUnequip: () => void;
  onUse: () => void;
  onDrop: () => void;
}) {
  return (
    <div className="border border-terminal-border p-3 space-y-2">
      {/* Item name + rarity */}
      <div>
        <div className={cn("font-bold", rarityColor(item.rarity))}>
          {item.name}
          {item.isEquipped && (
            <span className="text-terminal-amber ml-2 text-xs">[Equipped]</span>
          )}
        </div>
        <div className="text-terminal-border-bright text-[10px]">
          {itemTypeLabel(item.type)} | {RARITY[item.rarity].name}
          {item.quantity > 1 && ` | Qty: ${item.quantity}`}
        </div>
      </div>

      {/* Stats */}
      {Object.keys(item.stats).length > 0 && (
        <div className="text-terminal-green-dim text-xs">
          {formatStats(item.stats)}
        </div>
      )}

      {/* Description */}
      {item.description && (
        <div className="text-terminal-border-bright text-xs italic">
          {item.description}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-terminal-border pt-2 flex gap-3 text-xs">
        {isEquippable(item) && !item.isEquipped && (
          <button
            onClick={onEquip}
            className="text-terminal-green hover:terminal-glow transition-colors"
          >
            [E]quip
          </button>
        )}
        {isEquippable(item) && item.isEquipped && (
          <button
            onClick={onUnequip}
            className="text-terminal-green hover:terminal-glow transition-colors"
          >
            [U]nequip
          </button>
        )}
        {isUsable(item) && (
          <button
            onClick={onUse}
            className="text-terminal-blue hover:text-terminal-green transition-colors"
          >
            [U]se
          </button>
        )}
        <button
          onClick={onDrop}
          className="text-terminal-red hover:text-terminal-green transition-colors"
        >
          [D]rop
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function InventoryPanel({
  items,
  maxSlots,
  onEquip,
  onUnequip,
  onUse,
  onDrop,
  onClose,
  className,
}: InventoryPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build the grid slots: items + empty slots up to maxSlots
  const gridSlots = useMemo(() => {
    const slots: (GameItem | null)[] = [...items];
    while (slots.length < maxSlots) {
      slots.push(null);
    }
    return slots;
  }, [items, maxSlots]);

  const selectedItem = gridSlots[selectedIndex] ?? null;

  // ── Actions ──

  const handleEquip = useCallback(() => {
    if (selectedItem && isEquippable(selectedItem) && !selectedItem.isEquipped) {
      onEquip(selectedItem.id);
    }
  }, [selectedItem, onEquip]);

  const handleUnequip = useCallback(() => {
    if (selectedItem && isEquippable(selectedItem) && selectedItem.isEquipped) {
      onUnequip(selectedItem.id);
    }
  }, [selectedItem, onUnequip]);

  const handleUse = useCallback(() => {
    if (selectedItem && isUsable(selectedItem)) {
      onUse(selectedItem.id);
    }
  }, [selectedItem, onUse]);

  const handleDrop = useCallback(() => {
    if (selectedItem) {
      onDrop(selectedItem.id);
    }
  }, [selectedItem, onDrop]);

  // ── Keyboard ──

  const keyboardHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    handlers["Escape"] = onClose;

    // Arrow key navigation through grid
    handlers["ArrowUp"] = () => {
      setSelectedIndex((prev) => {
        const next = prev - GRID_COLUMNS;
        return next >= 0 ? next : prev;
      });
    };
    handlers["ArrowDown"] = () => {
      setSelectedIndex((prev) => {
        const next = prev + GRID_COLUMNS;
        return next < gridSlots.length ? next : prev;
      });
    };
    handlers["ArrowLeft"] = () => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    };
    handlers["ArrowRight"] = () => {
      setSelectedIndex((prev) =>
        prev < gridSlots.length - 1 ? prev + 1 : prev
      );
    };

    // Number keys for quick selection (1-9)
    for (let i = 1; i <= 9; i++) {
      handlers[String(i)] = () => {
        const idx = i - 1;
        if (idx < gridSlots.length) {
          setSelectedIndex(idx);
        }
      };
    }

    // Action keys
    handlers["e"] = handleEquip;
    handlers["E"] = handleEquip;

    // U = unequip if equipped equippable, use if usable
    handlers["u"] = () => {
      if (selectedItem?.isEquipped && isEquippable(selectedItem)) {
        handleUnequip();
      } else if (selectedItem && isUsable(selectedItem)) {
        handleUse();
      }
    };
    handlers["U"] = handlers["u"];

    handlers["d"] = handleDrop;
    handlers["D"] = handleDrop;

    return handlers;
  }, [
    gridSlots.length,
    selectedItem,
    onClose,
    handleEquip,
    handleUnequip,
    handleUse,
    handleDrop,
  ]);

  useKeyboard(keyboardHandlers);

  // ── Render ──

  // Build rows for grid display
  const gridRows = useMemo(() => {
    const rows: (GameItem | null)[][] = [];
    for (let i = 0; i < gridSlots.length; i += GRID_COLUMNS) {
      rows.push(gridSlots.slice(i, i + GRID_COLUMNS));
    }
    return rows;
  }, [gridSlots]);

  return (
    <div className={cn("font-mono text-sm space-y-3", className)}>
      {/* Title with slot count */}
      <div className="flex items-center justify-between">
        <span className="text-terminal-green terminal-glow font-bold">
          INVENTORY
        </span>
        <span className="text-terminal-border-bright text-xs">
          {items.length}/{maxSlots}
        </span>
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {gridRows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-4 gap-1">
            {row.map((item, colIdx) => {
              const idx = rowIdx * GRID_COLUMNS + colIdx;
              return (
                <InventoryCell
                  key={idx}
                  item={item}
                  index={idx}
                  isSelected={selectedIndex === idx}
                  onSelect={() => setSelectedIndex(idx)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected item detail */}
      {selectedItem && (
        <ItemDetailPanel
          item={selectedItem}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUse={handleUse}
          onDrop={handleDrop}
        />
      )}

      {/* Footer */}
      <div className="border-t border-terminal-border pt-1 text-[10px] text-terminal-border-bright text-center">
        Arrows: Navigate | [E]quip | [U]se/Unequip | [D]rop | [Esc] Close
      </div>
    </div>
  );
}
