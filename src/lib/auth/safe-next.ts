const ALLOWED = /^\/(app|staff|checkout|order)(?:[/?#]|$)/;

/**
 * Where to send a user after sign-in. Only same-site paths under the portals or
 * checkout are accepted; anything that could be read as another host
 * ("//evil", "/\\evil", encoded slashes, "/appevil") falls back to /app.
 */
export function safeNext(raw: string | null | undefined, staff: boolean): string {
  if (staff) return "/staff";
  const value = String(raw ?? "");
  if (!value || value.length > 512) return "/app";
  if (/[\\\s]/.test(value) || /%2f|%5c/i.test(value) || value.startsWith("//")) return "/app";
  return ALLOWED.test(value) ? value : "/app";
}
