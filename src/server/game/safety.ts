// ─── Content Safety Module ───────────────────────────────────────────────────
//
// Simple blocklist-based content filtering for user-generated and AI-generated
// text. Not exhaustive — focuses on obvious violations.

// ─── Blocked Patterns ───────────────────────────────────────────────────────

export const BLOCKED_PATTERNS: RegExp[] = [
  // Slurs and hate speech (abbreviated patterns to catch variations)
  /\bn[i1][g9]{2,}(?:er|a|ah?)\b/i,
  /\bf[a@]g{1,2}(?:ot|s)?\b/i,
  /\br[e3]t[a@]rd(?:ed|s)?\b/i,
  /\bk[i1]ke\b/i,
  /\bsp[i1]c[k]?\b/i,
  /\bch[i1]nk\b/i,
  /\btr[a@]nn(?:y|ie)\b/i,
  /\bwh[o0]re\b/i,

  // Sexual content
  /\br[a@]pe[ds]?\b/i,
  /\bmolest(?:ed|ing|er|ation)?\b/i,
  /\bpedophil(?:e|ia)\b/i,
  /\bincest\b/i,
  /\bbestiality\b/i,

  // Graphic real-world violence
  /\bschool\s*shoot(?:ing|er)\b/i,
  /\bmass\s*shoot(?:ing|er)\b/i,
  /\bgenocid(?:e|al)\b/i,
  /\beth?nic\s*cleans(?:e|ing)\b/i,
  /\bterroris[mt]\b/i,
  /\bsuicide\s*bomb(?:er|ing)?\b/i,
];

// Words that are blocked in names specifically (broader than general content)
const NAME_BLOCKED_PATTERNS: RegExp[] = [
  ...BLOCKED_PATTERNS,
  /\bass\b/i,
  /\bshit/i,
  /\bfuck/i,
  /\bdick\b/i,
  /\bcock\b/i,
  /\bcunt\b/i,
  /\bpussy\b/i,
  /\bbitch/i,
  /\bdamn\b/i,
  /\bhitler\b/i,
  /\bnazi/i,
  /\bsatan\b/i,
  /\bkill\s*all\b/i,
];

// ─── Validation Functions ───────────────────────────────────────────────────

export function validateContent(text: string): {
  safe: boolean;
  reason?: string;
} {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: "Content contains prohibited language",
      };
    }
  }
  return { safe: true };
}

export function validateCharacterName(name: string): {
  valid: boolean;
  reason?: string;
} {
  // Length check
  if (name.length < 2) {
    return { valid: false, reason: "Name must be at least 2 characters" };
  }
  if (name.length > 20) {
    return { valid: false, reason: "Name must be 20 characters or fewer" };
  }

  // Allowed characters: alphanumeric, spaces, hyphens, apostrophes, periods
  if (!/^[a-zA-Z0-9 '\-.]+$/.test(name)) {
    return {
      valid: false,
      reason: "Name contains invalid characters. Use letters, numbers, spaces, hyphens, apostrophes, or periods",
    };
  }

  // No excessive repeating characters (3+ of the same in a row)
  if (/(.)\1{2,}/i.test(name)) {
    return {
      valid: false,
      reason: "Name contains excessive repeating characters",
    };
  }

  // Must start with a letter or number
  if (!/^[a-zA-Z0-9]/.test(name)) {
    return { valid: false, reason: "Name must start with a letter or number" };
  }

  // Blocklist check
  for (const pattern of NAME_BLOCKED_PATTERNS) {
    if (pattern.test(name)) {
      return { valid: false, reason: "Name contains prohibited content" };
    }
  }

  return { valid: true };
}

export function sanitizeAIContent(text: string): string {
  let sanitized = text;

  for (const pattern of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) =>
      "*".repeat(match.length)
    );
  }

  return sanitized;
}
