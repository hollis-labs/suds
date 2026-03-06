import { describe, it, expect } from "vitest";
import { generateNPC, generateDialogueTree } from "@/server/game/npc";
import type { Theme } from "@/lib/constants";

const THEMES: Theme[] = ["horror", "funny", "epic", "dark_fantasy"];

describe("generateNPC", () => {
  it("produces a valid NPC with name and dialogue", () => {
    const npc = generateNPC("epic", 3);
    expect(npc.name).toBeTruthy();
    expect(typeof npc.name).toBe("string");
    expect(npc.description).toBeTruthy();
    expect(npc.dialogue).toBeTruthy();
    expect(typeof npc.dialogue).toBe("object");
  });

  it("NPC name contains a first name and title", () => {
    const npc = generateNPC("horror", 1);
    // Name should have at least two parts (firstName + title)
    expect(npc.name.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("NPC description is non-empty", () => {
    for (const theme of THEMES) {
      const npc = generateNPC(theme, 5);
      expect(npc.description.length).toBeGreaterThan(0);
    }
  });

  it("works for all themes", () => {
    for (const theme of THEMES) {
      const npc = generateNPC(theme, 3);
      expect(npc.name).toBeTruthy();
      expect(npc.dialogue.root).toBeTruthy();
    }
  });
});

describe("generateDialogueTree", () => {
  it("has a root node", () => {
    const tree = generateDialogueTree("epic");
    expect(tree.root).toBeDefined();
    expect(tree.root.id).toBe("root");
  });

  it("has at least 6 nodes", () => {
    for (const theme of THEMES) {
      const tree = generateDialogueTree(theme);
      expect(Object.keys(tree).length).toBeGreaterThanOrEqual(6);
    }
  });

  it("all dialogue choices reference valid next node IDs or null (end)", () => {
    for (const theme of THEMES) {
      const tree = generateDialogueTree(theme);
      const nodeIds = new Set(Object.keys(tree));

      for (const node of Object.values(tree)) {
        for (const choice of node.choices) {
          if (choice.nextId !== null) {
            expect(nodeIds).toContain(choice.nextId);
          }
        }
      }
    }
  });

  it("root node has choices", () => {
    const tree = generateDialogueTree("funny");
    expect(tree.root.choices.length).toBeGreaterThan(0);
  });

  it("root node text is non-empty", () => {
    for (const theme of THEMES) {
      const tree = generateDialogueTree(theme);
      expect(tree.root.text.length).toBeGreaterThan(0);
    }
  });

  it("has a farewell node that can end conversation", () => {
    const tree = generateDialogueTree("dark_fantasy");
    expect(tree.farewell).toBeDefined();
    const endChoices = tree.farewell.choices.filter((c) => c.nextId === null);
    expect(endChoices.length).toBeGreaterThan(0);
  });

  it("different themes produce different dialogue text", () => {
    const horrorTree = generateDialogueTree("horror");
    const funnyTree = generateDialogueTree("funny");

    // Root text should differ between themes
    // (technically could match by random chance, but extremely unlikely)
    // We check farewell nodes which are theme-specific
    expect(horrorTree.farewell.text).not.toBe(funnyTree.farewell.text);
  });
});
