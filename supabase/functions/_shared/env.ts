/** Read an env var in Deno (edge runtime) or Node (tests). Never throws. */
export function readEnv(name: string): string {
  const g = globalThis as unknown as {
    Deno?: { env: { get(n: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  try {
    if (g.Deno) return g.Deno.env.get(name) ?? "";
  } catch {
    // Deno without --allow-env
  }
  return g.process?.env?.[name] ?? "";
}
