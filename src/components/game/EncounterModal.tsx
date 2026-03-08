"use client";

import { useEffect, useRef } from "react";
import type { MonsterEncounter, Monster, Companion } from "@/lib/types";

interface EncounterModalProps {
  encounter: MonsterEncounter;
  playerName: string;
  companion?: Companion | null;
  onStartCombat: () => void;
}

function MonsterInfo({ monster }: { monster: Monster }) {
  return (
    <div
      className="border-2 rounded-sm px-3 py-2"
      style={{ borderColor: "#1a3a1a", backgroundColor: "rgba(13, 20, 13, 0.8)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-bold" style={{ color: "#ff4444" }}>
          {monster.name}
        </span>
        <span className="font-mono text-[10px]" style={{ color: "#1a8c1a" }}>
          Lv.{monster.level}
        </span>
      </div>
      {monster.description && (
        <p className="font-mono text-xs mt-1 leading-relaxed" style={{ color: "#8ab88a" }}>
          {monster.description}
        </p>
      )}
      <div className="font-mono text-[10px] mt-1 flex gap-3" style={{ color: "#1a8c1a" }}>
        <span>HP: {monster.hpMax}</span>
        <span>AC: {monster.ac}</span>
        <span>ATK: +{monster.attack}</span>
      </div>
      {monster.abilities.length > 0 && (
        <div className="font-mono text-[10px] mt-0.5" style={{ color: "#ffaa00" }}>
          Abilities: {monster.abilities.join(", ")}
        </div>
      )}
    </div>
  );
}

export function EncounterModal({
  encounter,
  playerName,
  companion,
  onStartCombat,
}: EncounterModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onStartCombat();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onStartCombat]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Encounter"
        className="relative z-10 w-full max-w-md border-2 rounded-sm shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]"
        style={{ borderColor: "#1a3a1a", backgroundColor: "rgba(10, 15, 10, 0.97)" }}
      >
        {/* Header */}
        <div
          className="text-center py-3 border-b-2"
          style={{ borderColor: "#1a3a1a" }}
        >
          <h2
            className="font-mono text-xl font-black uppercase tracking-widest"
            style={{ color: "#ff4444", textShadow: "0 0 12px rgba(255, 68, 68, 0.6)" }}
          >
            Encounter!
          </h2>
        </div>

        {/* VS Layout */}
        <div className="p-4">
          {/* Player side */}
          <div className="text-center mb-2">
            <span
              className="font-mono text-sm font-bold"
              style={{ color: "#33ff33", textShadow: "0 0 8px rgba(51, 255, 51, 0.4)" }}
            >
              {playerName}
            </span>
            {companion && companion.hp > 0 && (
              <span className="font-mono text-xs ml-2" style={{ color: "#44aaff" }}>
                &amp; {companion.name}
              </span>
            )}
          </div>

          {/* VS */}
          <div className="text-center my-3">
            <span
              className="font-mono text-2xl font-black"
              style={{ color: "#ffaa00", textShadow: "0 0 16px rgba(255, 170, 0, 0.5)" }}
            >
              VS
            </span>
          </div>

          {/* Monster side */}
          <div className="space-y-2 mb-4">
            {encounter.monsters.map((monster) => (
              <MonsterInfo key={monster.id} monster={monster} />
            ))}
          </div>

          {/* Action button */}
          <button
            ref={buttonRef}
            onClick={onStartCombat}
            className="w-full py-3 font-mono text-sm font-bold uppercase tracking-wider border-2 rounded-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            style={{
              borderColor: "#33ff33",
              backgroundColor: "rgba(51, 255, 51, 0.1)",
              color: "#33ff33",
              textShadow: "0 0 8px rgba(51, 255, 51, 0.4)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(51, 255, 51, 0.2)";
              e.currentTarget.style.boxShadow = "0 0 16px rgba(51, 255, 51, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(51, 255, 51, 0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Roll Initiative
          </button>
        </div>
      </div>
    </div>
  );
}
