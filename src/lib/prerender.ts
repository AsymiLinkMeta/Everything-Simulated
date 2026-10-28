/**
 * Glue between the app and the build-time prerender (scripts/prerender.mjs).
 *
 * Build time: a route's head() payload is recorded while the page renders, so the
 * static HTML gets the same title, description, canonical and Open Graph tags the
 * browser sets later.
 *
 * Browser: dist/<page>.html already contains the page. Public pages are lazy chunks,
 * so until the chunk arrives the app would show "Loading…" over that content. The
 * prerendered page body is kept and shown instead, for the URL it was built for only.
 */
let head: unknown = null;

export function setPrerenderHead(payload: unknown) {
  head = payload;
}

export function takePrerenderHead(): unknown {
  const h = head;
  head = null;
  return h;
}

let snapshot: { path: string; html: string } | null = null;

/** Call before the app mounts (it replaces the prerendered markup). */
export function capturePrerenderSnapshot(root: HTMLElement) {
  const path = root.getAttribute("data-prerendered");
  const main = root.querySelector("main");
  if (path && path !== "*" && path === window.location.pathname && main) snapshot = { path, html: main.innerHTML };
}

export function prerenderSnapshotFor(pathname: string): string | null {
  return snapshot && snapshot.path === pathname ? snapshot.html : null;
}
