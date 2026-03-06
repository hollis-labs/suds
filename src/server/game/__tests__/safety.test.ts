import { describe, it, expect } from "vitest";
import {
  validateContent,
  validateCharacterName,
  sanitizeAIContent,
} from "@/server/game/safety";

describe("validateContent", () => {
  it("flags obvious hate speech", () => {
    const result = validateContent("some hateful slur content with genocide");
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("flags sexual violence terms", () => {
    const result = validateContent("the villain committed molestation");
    expect(result.safe).toBe(false);
  });

  it("flags terrorism references", () => {
    const result = validateContent("the character was a terrorist");
    expect(result.safe).toBe(false);
  });

  it("passes normal game text", () => {
    expect(
      validateContent("The warrior swung their sword at the goblin").safe
    ).toBe(true);
  });

  it("passes fantasy violence descriptions", () => {
    expect(
      validateContent(
        "The dragon breathed fire across the battlefield, scorching the undead horde"
      ).safe
    ).toBe(true);
  });

  it("passes dialogue and narrative text", () => {
    expect(
      validateContent(
        "Welcome to the tavern, adventurer. What brings you to these lands?"
      ).safe
    ).toBe(true);
  });

  it("passes item descriptions", () => {
    expect(
      validateContent(
        "A gleaming longsword with runes etched into the blade. +3 to attack."
      ).safe
    ).toBe(true);
  });
});

describe("validateCharacterName", () => {
  it("rejects names that are too short", () => {
    const result = validateCharacterName("A");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("at least 2");
  });

  it("rejects names that are too long", () => {
    const result = validateCharacterName("A".repeat(21));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("20 characters");
  });

  it("rejects names with special characters", () => {
    const result = validateCharacterName("Test@Name!");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("invalid characters");
  });

  it("rejects names with excessive repeating characters", () => {
    const result = validateCharacterName("Goooble");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("repeating");
  });

  it("rejects names containing blocked content", () => {
    const result = validateCharacterName("Hitler");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("prohibited");
  });

  it("rejects names containing profanity", () => {
    const result = validateCharacterName("ShitLord");
    expect(result.valid).toBe(false);
  });

  it("accepts valid fantasy names", () => {
    expect(validateCharacterName("Aragorn").valid).toBe(true);
    expect(validateCharacterName("Drizzt Do'Urden").valid).toBe(true);
    expect(validateCharacterName("El-Rynn").valid).toBe(true);
    expect(validateCharacterName("St. Marcus").valid).toBe(true);
  });

  it("accepts names with numbers", () => {
    expect(validateCharacterName("Agent 47").valid).toBe(true);
  });

  it("rejects names starting with special characters", () => {
    const result = validateCharacterName("-Test");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("start with");
  });
});

describe("sanitizeAIContent", () => {
  it("strips flagged content from text", () => {
    const input = "The village faced genocide at the hands of the warlord";
    const result = sanitizeAIContent(input);
    expect(result).not.toContain("genocide");
    expect(result).toContain("*");
  });

  it("leaves clean text untouched", () => {
    const input = "The brave knight entered the dungeon cautiously.";
    const result = sanitizeAIContent(input);
    expect(result).toBe(input);
  });

  it("handles text with multiple violations", () => {
    const input = "terrorist genocide plot";
    const result = sanitizeAIContent(input);
    expect(result).not.toContain("terrorist");
    expect(result).not.toContain("genocide");
  });
});
