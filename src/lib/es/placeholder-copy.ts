/**
 * Placeholder text that was seeded into live rows before the real copy arrived.
 * It must never reach customers: treat it as empty so the field is hidden.
 */
const PLACEHOLDER_PATTERNS = [/theirs to fill/i, /this card updates when they send/i, /personal spec lands when they send/i, /lorem ipsum/i, /^\s*(tbc|tbd|todo|placeholder)\.?\s*$/i];

export function isPlaceholderCopy(text: string | null | undefined): boolean {
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

/** Trimmed public copy, or "" when it's empty or seeded placeholder text. */
export function publicCopy(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  return t && !isPlaceholderCopy(t) ? t : "";
}
