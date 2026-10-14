/** Escape a value for safe interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then turn newlines into <br> so plain-text staff replies keep their shape. */
export function escapeMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** Strip CR/LF so a value cannot inject extra mail headers via the subject line. */
export function safeHeader(value: unknown, max = 200): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}
