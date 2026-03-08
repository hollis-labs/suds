"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText, TerminalInput } from "@/components/terminal";
import { StatBlock } from "@/components/game/StatBlock";
import { cn } from "@/lib/utils";
import {
  CLASS_DEFINITIONS,
  THEMES,
  GAME_CONFIG,
  statModifier,
} from "@/lib/constants";
import type { CharacterClass, Theme } from "@/lib/constants";
import type { Stats } from "@/lib/types";
import { trpc } from "@/lib/trpc";

type WizardStep = "name" | "class" | "theme" | "confirm";

interface WizardState {
  name: string;
  characterClass: CharacterClass | null;
  theme: Theme | null;
}

const CLASS_KEYS = Object.keys(CLASS_DEFINITIONS) as CharacterClass[];
const THEME_KEYS = Object.keys(THEMES) as Theme[];

function formatAbilityName(ability: string): string {
  return ability
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function validateName(name: string): string | null {
  if (name.length < 2) return "Name must be at least 2 characters.";
  if (name.length > 20) return "Name must be 20 characters or less.";
  if (!/^[a-zA-Z0-9 ]+$/.test(name))
    return "Name may only contain letters, numbers, and spaces.";
  return null;
}

export default function NewCharacterPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("name");
  const [wizard, setWizard] = useState<WizardState>({
    name: "",
    characterClass: null,
    theme: null,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createCharacter = trpc.character.create.useMutation();

  const handleNameSubmit = useCallback(
    (value: string) => {
      const error = validateName(value);
      if (error) {
        setNameError(error);
        return;
      }
      setNameError(null);
      setWizard((prev) => ({ ...prev, name: value }));
      setStep("class");
    },
    []
  );

  const handleClassSelect = useCallback((classKey: CharacterClass) => {
    setWizard((prev) => ({ ...prev, characterClass: classKey }));
    setStep("theme");
  }, []);

  const handleThemeSelect = useCallback((themeKey: Theme) => {
    setWizard((prev) => ({ ...prev, theme: themeKey }));
    setStep("confirm");
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!wizard.characterClass || !wizard.theme) return;
    setIsCreating(true);

    try {
      const newChar = await createCharacter.mutateAsync({
        name: wizard.name,
        class: wizard.characterClass,
        theme: wizard.theme,
      });
      router.push(`/play/${newChar.id}`);
    } catch (err) {
      console.error("Character creation failed:", err);
      setIsCreating(false);
    }
  }, [wizard, router]);

  const handleBack = useCallback(() => {
    switch (step) {
      case "class":
        setStep("name");
        break;
      case "theme":
        setStep("class");
        break;
      case "confirm":
        setStep("theme");
        break;
      default:
        router.push("/characters");
    }
  }, [step, router]);

  const handleCancel = useCallback(() => {
    router.push("/characters");
  }, [router]);

  // Keyboard handling for class, theme, and confirm steps
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (step === "name") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleBack();
        }
        return;
      }

      if (step === "class") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleBack();
          return;
        }
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= CLASS_KEYS.length) {
          e.preventDefault();
          handleClassSelect(CLASS_KEYS[num - 1]);
        }
        return;
      }

      if (step === "theme") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleBack();
          return;
        }
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= THEME_KEYS.length) {
          e.preventDefault();
          handleThemeSelect(THEME_KEYS[num - 1]);
        }
        return;
      }

      if (step === "confirm") {
        const key = e.key.toLowerCase();
        if (key === "c") {
          e.preventDefault();
          handleConfirm();
        } else if (key === "b") {
          e.preventDefault();
          handleBack();
        } else if (key === "x") {
          e.preventDefault();
          handleCancel();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, handleBack, handleCancel, handleConfirm, handleClassSelect, handleThemeSelect]);

  function renderStepIndicator() {
    const steps: { key: WizardStep; label: string }[] = [
      { key: "name", label: "NAME" },
      { key: "class", label: "CLASS" },
      { key: "theme", label: "THEME" },
      { key: "confirm", label: "DEPLOY" },
    ];

    const currentIndex = steps.findIndex((s) => s.key === step);

    return (
      <div className="flex gap-2 text-xs font-mono mb-4">
        {steps.map((s, i) => (
          <span key={s.key}>
            <span
              className={cn(
                i === currentIndex
                  ? "text-terminal-green terminal-glow"
                  : i < currentIndex
                    ? "text-terminal-green-dim"
                    : "text-terminal-border-bright"
              )}
            >
              [{i + 1}] {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-terminal-border-bright"> &gt; </span>
            )}
          </span>
        ))}
      </div>
    );
  }

  function renderNameStep() {
    return (
      <div className="space-y-4">
        <h2 className="text-terminal-green terminal-glow font-bold">
          IDENTITY CONFIGURATION
        </h2>
        <TerminalText
          text="Enter your character's name:"
          speed={25}
          className="text-terminal-green-dim text-sm"
        />
        <TerminalInput
          prompt="NAME>"
          onSubmit={handleNameSubmit}
          placeholder="2-20 characters, alphanumeric"
        />
        {nameError && (
          <p className="text-terminal-red text-xs font-mono">{nameError}</p>
        )}
        <p className="text-terminal-border-bright text-xs font-mono">
          [Enter] Proceed | [Esc] Back
        </p>
      </div>
    );
  }

  function renderClassStep() {
    return (
      <div className="space-y-4">
        <h2 className="text-terminal-green terminal-glow font-bold">
          CLASS SELECTION
        </h2>
        <p className="text-terminal-green-dim text-sm font-mono">
          Creating: <span className="text-terminal-green">{wizard.name}</span>
        </p>

        <div className="space-y-3">
          {CLASS_KEYS.map((classKey, index) => {
            const def = CLASS_DEFINITIONS[classKey];
            const stats = def.startingStats;
            const startAbilities = def.abilities[1] ?? [];

            return (
              <button
                key={classKey}
                onClick={() => handleClassSelect(classKey)}
                className={cn(
                  "w-full text-left px-2 py-2 transition-colors border border-transparent",
                  "hover:border-terminal-border hover:bg-terminal-green/5"
                )}
              >
                <div className="text-terminal-green font-bold">
                  <span className="text-terminal-amber">[{index + 1}]</span>{" "}
                  {def.name.toUpperCase()}
                  <span className="text-terminal-green-dim font-normal">
                    {" "}
                    — {def.description}
                  </span>
                </div>
                <div className="ml-5 mt-1 text-xs text-terminal-green-dim font-mono">
                  STR:{String(stats.str).padStart(2, " ")} DEX:
                  {String(stats.dex).padStart(2, " ")} CON:
                  {String(stats.con).padStart(2, " ")} INT:
                  {String(stats.int).padStart(2, " ")} WIS:
                  {String(stats.wis).padStart(2, " ")} CHA:
                  {String(stats.cha).padStart(2, " ")}
                </div>
                <div className="ml-5 mt-0.5 text-xs text-terminal-green-dim font-mono">
                  HP Die: d{def.hpDie} | Starting Abilities:{" "}
                  {startAbilities.map(formatAbilityName).join(", ")}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-terminal-border-bright text-xs font-mono">
          [1-{CLASS_KEYS.length}] Select | [Esc] Back
        </p>
      </div>
    );
  }

  function renderThemeStep() {
    return (
      <div className="space-y-4">
        <h2 className="text-terminal-green terminal-glow font-bold">
          WORLD CONFIGURATION
        </h2>
        <p className="text-terminal-green-dim text-sm font-mono">
          Choose the flavor of your dungeon:
        </p>

        <div className="space-y-2">
          {THEME_KEYS.map((themeKey, index) => {
            const def = THEMES[themeKey];

            return (
              <button
                key={themeKey}
                onClick={() => handleThemeSelect(themeKey)}
                className={cn(
                  "w-full text-left px-2 py-1.5 transition-colors border border-transparent",
                  "hover:border-terminal-border hover:bg-terminal-green/5"
                )}
              >
                <span className="text-terminal-amber">[{index + 1}]</span>{" "}
                <span className="text-terminal-green font-bold">
                  {def.name.toUpperCase()}
                </span>
                <span className="text-terminal-green-dim">
                  {" "}
                  — {def.description}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-terminal-border-bright text-xs font-mono">
          [1-{THEME_KEYS.length}] Select | [Esc] Back
        </p>
      </div>
    );
  }

  function renderConfirmStep() {
    if (!wizard.characterClass || !wizard.theme) return null;

    const classDef = CLASS_DEFINITIONS[wizard.characterClass];
    const themeDef = THEMES[wizard.theme];
    const stats: Stats = { ...classDef.startingStats };
    const conMod = statModifier(stats.con);
    const hp = classDef.hpDie + conMod;
    const mp = classDef.mpBase;
    const ac = classDef.startingAC;
    const gold = GAME_CONFIG.STARTING_GOLD;

    return (
      <div className="space-y-4">
        <h2 className="text-terminal-green terminal-glow font-bold">
          DEPLOYMENT BRIEFING
        </h2>

        <div className="space-y-3 font-mono text-sm">
          <div className="space-y-1">
            <div className="text-terminal-green-dim">
              Name:{" "}
              <span className="text-terminal-green font-bold">
                {wizard.name}
              </span>
            </div>
            <div className="text-terminal-green-dim">
              Class:{" "}
              <span className="text-terminal-green">{classDef.name}</span>
            </div>
            <div className="text-terminal-green-dim">
              Theme:{" "}
              <span className="text-terminal-amber">{themeDef.name}</span>
            </div>
          </div>

          <div className="border-t border-terminal-border pt-3">
            <p className="text-terminal-green-dim text-xs mb-2">
              Starting Stats:
            </p>
            <StatBlock stats={stats} />
          </div>

          <div className="border-t border-terminal-border pt-3 text-terminal-green-dim">
            <TerminalText
              text={`HP: ${hp}/${hp}  MP: ${mp}/${mp}  AC: ${ac}  Gold: ${gold}`}
              speed={20}
              className="text-terminal-green"
            />
          </div>
        </div>

        <div className="border-t border-terminal-border pt-4 space-y-1 font-mono text-sm">
          <button
            onClick={handleConfirm}
            disabled={isCreating}
            className={cn(
              "block w-full text-left px-2 py-0.5 transition-colors",
              isCreating
                ? "text-terminal-border-bright"
                : "text-terminal-green-dim hover:text-terminal-green hover:terminal-glow"
            )}
          >
            <span className="text-terminal-amber">[C]</span>{" "}
            {isCreating ? "Deploying..." : "Confirm and Deploy"}
          </button>
          <button
            onClick={handleBack}
            disabled={isCreating}
            className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
          >
            <span className="text-terminal-amber">[B]</span> Back
          </button>
          <button
            onClick={handleCancel}
            disabled={isCreating}
            className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
          >
            <span className="text-terminal-amber">[X]</span> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Terminal title="NEW CHARACTER" className="w-full max-w-2xl">
        <div className="space-y-4">
          {renderStepIndicator()}

          {step === "name" && renderNameStep()}
          {step === "class" && renderClassStep()}
          {step === "theme" && renderThemeStep()}
          {step === "confirm" && renderConfirmStep()}
        </div>
      </Terminal>
    </div>
  );
}
