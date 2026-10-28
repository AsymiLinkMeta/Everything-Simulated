export function applyHead(
  template: string,
  head: unknown,
  opts: { url: string; noindex: boolean },
): { html: string; title: string; description: string; canonical: string | null };
export function rewriteRedirects(redirects: string, prerendered: string[]): string;
