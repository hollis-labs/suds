"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { RARITY } from "@/lib/constants";
import type { Store, StoreItem, Player, GameItem } from "@/lib/types";

type StoreTab = "buy" | "sell";
type BuySection = "local" | "marketplace";

type SortOrder = "price-desc" | "price-asc" | "name" | "rarity";

interface StorePanelProps {
  store: Store;
  player: Player;
  inventory: GameItem[];
  onBuy: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onClose: () => void;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const SELL_RATIO = 0.4;

function itemTypeLabel(type: GameItem["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function rarityColor(rarity: GameItem["rarity"]): string {
  return RARITY[rarity]?.color ?? "text-terminal-white";
}

function formatStats(stats: Record<string, number>): string {
  return Object.entries(stats)
    .map(([k, v]) => `${k.toUpperCase()} +${v}`)
    .join(", ");
}

// ── Item Row ─────────────────────────────────────────────────────────

function StoreItemRow({
  storeItem,
  index,
  isSelected,
  canAfford,
  onSelect,
}: {
  storeItem: StoreItem;
  index: number;
  isSelected: boolean;
  canAfford: boolean;
  onSelect: () => void;
}) {
  const { item, price, stock } = storeItem;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "block text-left text-xs px-1 py-0.5 transition-colors w-full",
        isSelected && canAfford && "bg-terminal-green/5 terminal-glow",
        !canAfford && "opacity-40 cursor-not-allowed",
        canAfford && !isSelected && "hover:bg-terminal-green/5"
      )}
    >
      <span className="text-terminal-green">[{index + 1}]</span>{" "}
      <span className={rarityColor(item.rarity)}>{item.name}</span>
      <span className="text-terminal-border-bright ml-2">
        {itemTypeLabel(item.type)}
      </span>
      <span className={cn("ml-2", rarityColor(item.rarity))}>
        {RARITY[item.rarity].name}
      </span>
      <span className="text-terminal-gold ml-2">{price}g</span>
      {stock > 0 && (
        <span className="text-terminal-border-bright ml-2">x{stock}</span>
      )}
    </button>
  );
}

// ── Sell Item Row ────────────────────────────────────────────────────

function SellItemRow({
  item,
  sellPrice,
  index,
  isSelected,
  onSelect,
}: {
  item: GameItem;
  sellPrice: number;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "block text-left text-xs px-1 py-0.5 transition-colors w-full",
        isSelected && "bg-terminal-green/5 terminal-glow",
        !isSelected && "hover:bg-terminal-green/5"
      )}
    >
      <span className="text-terminal-green">[{index + 1}]</span>{" "}
      <span className={rarityColor(item.rarity)}>{item.name}</span>
      {item.isEquipped && (
        <span className="text-terminal-amber ml-1">[E]</span>
      )}
      {item.quantity > 1 && (
        <span className="text-terminal-border-bright ml-1">x{item.quantity}</span>
      )}
      <span className="text-terminal-gold ml-2">{sellPrice}g</span>
    </button>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────

function ItemDetail({
  item,
  price,
  isSelling,
}: {
  item: GameItem;
  price: number;
  isSelling: boolean;
}) {
  return (
    <div className="border border-terminal-border p-2 mt-2 text-xs space-y-1">
      <div className={cn("font-bold", rarityColor(item.rarity))}>
        {item.name}
      </div>
      <div className="text-terminal-border-bright">
        {itemTypeLabel(item.type)} | {RARITY[item.rarity].name}
      </div>
      {Object.keys(item.stats).length > 0 && (
        <div className="text-terminal-green-dim">{formatStats(item.stats)}</div>
      )}
      {item.description && (
        <div className="text-terminal-border-bright italic">
          {item.description}
        </div>
      )}
      <div className="border-t border-terminal-border pt-1 mt-1">
        <span className="text-terminal-gold">
          {isSelling ? "Sell" : "Buy"} Price: {price}g
        </span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

const RARITY_ORDER: Record<string, number> = {
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

export function StorePanel({
  store,
  player,
  inventory,
  onBuy,
  onSell,
  onClose,
  className,
}: StorePanelProps) {
  const [tab, setTab] = useState<StoreTab>("buy");
  const [buySection, setBuySection] = useState<BuySection>("local");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const [sellSort, setSellSort] = useState<SortOrder>("price-desc");

  // Current store items based on tab/section
  const currentBuyItems = useMemo(() => {
    return buySection === "local"
      ? store.localInventory
      : store.marketplaceInventory;
  }, [store, buySection]);

  const currentSellItems = useMemo(() => {
    const withPrices = inventory.map((item) => ({
      item,
      sellPrice: Math.floor(
        (Object.values(item.stats).reduce((a, b) => a + b, 0) * 10 || 10) *
          RARITY[item.rarity].priceMultiplier *
          SELL_RATIO
      ),
    }));

    // Sort: unequipped first, then by selected sort order
    withPrices.sort((a, b) => {
      // Equipped items always at bottom
      if (a.item.isEquipped !== b.item.isEquipped) {
        return a.item.isEquipped ? 1 : -1;
      }
      switch (sellSort) {
        case "price-desc":
          return b.sellPrice - a.sellPrice;
        case "price-asc":
          return a.sellPrice - b.sellPrice;
        case "name":
          return a.item.name.localeCompare(b.item.name);
        case "rarity":
          return (RARITY_ORDER[b.item.rarity] ?? 0) - (RARITY_ORDER[a.item.rarity] ?? 0);
        default:
          return 0;
      }
    });

    return withPrices;
  }, [inventory, sellSort]);

  // Clamp selected index
  const maxIndex =
    tab === "buy" ? currentBuyItems.length - 1 : currentSellItems.length - 1;

  const clampedIndex = Math.max(0, Math.min(selectedIndex, maxIndex));

  // Selected item detail
  const selectedBuyItem =
    tab === "buy" ? currentBuyItems[clampedIndex] : undefined;
  const selectedSellEntry =
    tab === "sell" ? currentSellItems[clampedIndex] : undefined;

  const handleBuy = useCallback(() => {
    if (!selectedBuyItem) return;
    if (player.gold < selectedBuyItem.price) return;

    if (!confirmPurchase) {
      setConfirmPurchase(true);
      return;
    }

    onBuy(selectedBuyItem.item.id);
    setConfirmPurchase(false);
  }, [selectedBuyItem, player.gold, confirmPurchase, onBuy]);

  const handleSell = useCallback(() => {
    if (!selectedSellEntry) return;

    if (!confirmPurchase) {
      setConfirmPurchase(true);
      return;
    }

    onSell(selectedSellEntry.item.id);
    setConfirmPurchase(false);
  }, [selectedSellEntry, confirmPurchase, onSell]);

  // ── Keyboard ──

  const keyboardHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    handlers["Escape"] = () => {
      if (confirmPurchase) {
        setConfirmPurchase(false);
      } else {
        onClose();
      }
    };

    handlers["b"] = () => {
      setTab("buy");
      setSelectedIndex(0);
      setConfirmPurchase(false);
    };
    handlers["B"] = handlers["b"];

    handlers["s"] = () => {
      setTab("sell");
      setSelectedIndex(0);
      setConfirmPurchase(false);
    };
    handlers["S"] = handlers["s"];

    handlers["ArrowUp"] = () => {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      setConfirmPurchase(false);
    };
    handlers["ArrowDown"] = () => {
      setSelectedIndex((prev) => Math.min(maxIndex, prev + 1));
      setConfirmPurchase(false);
    };

    handlers["Tab"] = () => {
      if (tab === "buy") {
        setBuySection((prev) => (prev === "local" ? "marketplace" : "local"));
        setSelectedIndex(0);
        setConfirmPurchase(false);
      }
    };

    handlers["Enter"] = () => {
      if (tab === "buy") {
        handleBuy();
      } else {
        handleSell();
      }
    };

    // Number keys for quick selection
    for (let i = 1; i <= 9; i++) {
      handlers[String(i)] = () => {
        const idx = i - 1;
        const max = tab === "buy" ? currentBuyItems.length : currentSellItems.length;
        if (idx < max) {
          setSelectedIndex(idx);
          setConfirmPurchase(false);
        }
      };
    }

    return handlers;
  }, [
    tab,
    maxIndex,
    confirmPurchase,
    currentBuyItems.length,
    currentSellItems.length,
    onClose,
    handleBuy,
    handleSell,
  ]);

  useKeyboard(keyboardHandlers);

  // ── Render ──

  return (
    <div className={cn("font-mono text-sm space-y-2", className)}>
      {/* Store name */}
      <div className="text-terminal-green terminal-glow font-bold text-center">
        {store.name}
      </div>

      {/* Gold display */}
      <div className="text-xs text-center">
        <span className="text-terminal-border-bright">Your Gold: </span>
        <span className="text-terminal-gold">{player.gold}g</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-4 border-b border-terminal-border pb-1">
        <button
          onClick={() => {
            setTab("buy");
            setSelectedIndex(0);
            setConfirmPurchase(false);
          }}
          className={cn(
            "text-xs transition-colors",
            tab === "buy"
              ? "text-terminal-green terminal-glow"
              : "text-terminal-green-dim hover:text-terminal-green"
          )}
        >
          [B]uy
        </button>
        <button
          onClick={() => {
            setTab("sell");
            setSelectedIndex(0);
            setConfirmPurchase(false);
          }}
          className={cn(
            "text-xs transition-colors",
            tab === "sell"
              ? "text-terminal-green terminal-glow"
              : "text-terminal-green-dim hover:text-terminal-green"
          )}
        >
          [S]ell
        </button>
      </div>

      {/* Buy tab content */}
      {tab === "buy" && (
        <div className="space-y-2">
          {/* Section toggle */}
          <div className="flex gap-3 text-[10px] uppercase tracking-wider">
            <button
              onClick={() => {
                setBuySection("local");
                setSelectedIndex(0);
                setConfirmPurchase(false);
              }}
              className={cn(
                buySection === "local"
                  ? "text-terminal-green"
                  : "text-terminal-border-bright hover:text-terminal-green-dim"
              )}
            >
              Local Goods
            </button>
            <span className="text-terminal-border">|</span>
            <button
              onClick={() => {
                setBuySection("marketplace");
                setSelectedIndex(0);
                setConfirmPurchase(false);
              }}
              className={cn(
                buySection === "marketplace"
                  ? "text-terminal-green"
                  : "text-terminal-border-bright hover:text-terminal-green-dim"
              )}
            >
              Marketplace
            </button>
            <span className="text-terminal-border-bright ml-auto">[Tab] Switch</span>
          </div>

          {/* Item list */}
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {currentBuyItems.length === 0 ? (
              <div className="text-terminal-border-bright text-xs italic">
                No items available.
              </div>
            ) : (
              currentBuyItems.map((storeItem, i) => (
                <StoreItemRow
                  key={storeItem.item.id}
                  storeItem={storeItem}
                  index={i}
                  isSelected={clampedIndex === i}
                  canAfford={player.gold >= storeItem.price}
                  onSelect={() => {
                    setSelectedIndex(i);
                    setConfirmPurchase(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Selected item detail */}
          {selectedBuyItem && (
            <ItemDetail
              item={selectedBuyItem.item}
              price={selectedBuyItem.price}
              isSelling={false}
            />
          )}

          {/* Purchase prompt */}
          {selectedBuyItem && player.gold >= selectedBuyItem.price && (
            <div className="text-xs text-center">
              {confirmPurchase ? (
                <span className="text-terminal-amber">
                  Confirm purchase? [Enter] Yes | [Esc] Cancel
                </span>
              ) : (
                <span className="text-terminal-green-dim">
                  [Enter] Purchase
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sell tab content */}
      {tab === "sell" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
            <span className="text-terminal-border-bright">
              Your Items (sell at {SELL_RATIO * 100}% value)
            </span>
            <div className="flex gap-2">
              <span className="text-terminal-border-bright">Sort:</span>
              {(
                [
                  { id: "price-desc", label: "Gold↓" },
                  { id: "price-asc", label: "Gold↑" },
                  { id: "name", label: "Name" },
                  { id: "rarity", label: "Rarity" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSellSort(s.id);
                    setSelectedIndex(0);
                    setConfirmPurchase(false);
                  }}
                  className={cn(
                    "transition-colors",
                    sellSort === s.id
                      ? "text-terminal-green"
                      : "text-terminal-border-bright hover:text-terminal-green-dim"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {currentSellItems.length === 0 ? (
              <div className="text-terminal-border-bright text-xs italic">
                No items to sell.
              </div>
            ) : (
              currentSellItems.map(({ item, sellPrice }, i) => (
                <SellItemRow
                  key={item.id}
                  item={item}
                  sellPrice={sellPrice}
                  index={i}
                  isSelected={clampedIndex === i}
                  onSelect={() => {
                    setSelectedIndex(i);
                    setConfirmPurchase(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Selected sell item detail */}
          {selectedSellEntry && (
            <ItemDetail
              item={selectedSellEntry.item}
              price={selectedSellEntry.sellPrice}
              isSelling={true}
            />
          )}

          {/* Sell prompt */}
          {selectedSellEntry && (
            <div className="text-xs text-center">
              {confirmPurchase ? (
                <span className="text-terminal-amber">
                  Confirm sell? [Enter] Yes | [Esc] Cancel
                </span>
              ) : (
                <span className="text-terminal-green-dim">[Enter] Sell</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-terminal-border pt-1 text-[10px] text-terminal-border-bright text-center">
        [Esc] Close Store
      </div>
    </div>
  );
}
