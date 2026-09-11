import { useEffect, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import {
  Link as RRLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

export { Outlet, Navigate, useLocation };

type LinkProps = {
  to: string;
  params?: Record<string, string>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: MouseEventHandler;
  activeProps?: { className?: string };
  activeOptions?: { exact?: boolean };
};

export function Link({ to, params, className, style, children, ...rest }: LinkProps) {
  let path = String(to ?? "/");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      path = path.replace(`$${k}`, v);
    }
  }
  return (
    <RRLink to={path} className={className} style={style} {...rest}>
      {children}
    </RRLink>
  );
}

function setMeta(selector: string, attr: string, key: string, content: string) {
  let el = document.head.querySelector(`${selector}[${attr}="${key}"]`) as HTMLMetaElement | HTMLLinkElement | null;
  if (!el) {
    el = document.createElement(selector === "link" ? "link" : "meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (selector === "link") (el as HTMLLinkElement).href = content;
  else (el as HTMLMetaElement).content = content;
}

function upsertLink(l: { rel?: string; href?: string; hreflang?: string; hrefLang?: string; type?: string }) {
  if (!l.rel || !l.href) return;
  const hreflang = l.hreflang || l.hrefLang;
  let el: HTMLLinkElement | null = null;
  if (hreflang) {
    el = document.head.querySelector(`link[rel="${l.rel}"][hreflang="${hreflang}"]`);
  } else if (l.rel === "canonical") {
    el = document.head.querySelector('link[rel="canonical"]');
  } else {
    el = document.head.querySelector(`link[rel="${l.rel}"]:not([hreflang])`);
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = l.rel;
    if (hreflang) el.setAttribute("hreflang", hreflang);
    if (l.type) el.type = l.type;
    document.head.appendChild(el);
  }
  el.href = l.href;
}

const PUBLIC_ORIGIN = "https://everythingsimulated.com.au";
const PUBLIC_OG = `${PUBLIC_ORIGIN}/og.jpg`;

export function applyHeadPayload(head: unknown) {
  if (!head || typeof head !== "object") return;
  const h = head as { meta?: Array<Record<string, string>>; links?: Array<Record<string, string>> };
  let description = "";
  let title = document.title;
  const has = new Set<string>();
  for (const m of h.meta ?? []) {
    if (m.title) {
      document.title = m.title;
      title = m.title;
    }
    if (m.name && m.content) {
      setMeta("meta", "name", m.name, m.content);
      has.add(`name:${m.name}`);
      if (m.name === "description") description = m.content;
    }
    if (m.property && m.content) {
      setMeta("meta", "property", m.property, m.content);
      has.add(`property:${m.property}`);
    }
  }
  for (const l of h.links ?? []) {
    upsertLink(l);
  }
  const url = `${PUBLIC_ORIGIN}${window.location.pathname || "/"}`;
  if (!has.has("property:og:title")) setMeta("meta", "property", "og:title", title);
  if (description && !has.has("property:og:description")) setMeta("meta", "property", "og:description", description);
  if (!has.has("property:og:url")) setMeta("meta", "property", "og:url", url);
  if (!has.has("property:og:image")) setMeta("meta", "property", "og:image", PUBLIC_OG);
  if (!has.has("property:og:type")) setMeta("meta", "property", "og:type", "website");
  if (!has.has("property:og:locale")) setMeta("meta", "property", "og:locale", "en_AU");
  if (!has.has("property:og:site_name")) setMeta("meta", "property", "og:site_name", "Everything Simulated");
  if (!has.has("name:twitter:card")) setMeta("meta", "name", "twitter:card", "summary_large_image");
  if (!has.has("name:twitter:image")) setMeta("meta", "name", "twitter:image", PUBLIC_OG);
  if (!has.has("name:twitter:title")) setMeta("meta", "name", "twitter:title", title);
  if (description && !has.has("name:twitter:description")) setMeta("meta", "name", "twitter:description", description);
  if (!(h.links ?? []).some((l) => l.rel === "canonical")) upsertLink({ rel: "canonical", href: url });
}

export function createFileRoute(_path: string) {
  return (opts: {
    component?: React.ComponentType;
    loader?: (ctx: { params: Record<string, string> }) => unknown;
    head?: (ctx: { params: Record<string, string>; loaderData?: unknown }) => unknown;
    notFoundComponent?: React.ComponentType;
  }) => {
    const Inner = opts.component;
    function RoutedPage() {
      const params = useParams() as Record<string, string>;
      const loc = useLocation();
      useEffect(() => {
        try {
          const loaderData = opts.loader ? opts.loader({ params }) : params;
          if (typeof opts.head === "function") applyHeadPayload(opts.head({ params, loaderData }));
        } catch {
          // loader may throw notFound; the page body handles it
        }
      }, [loc.pathname, loc.search]);
      if (!Inner) return null;
      return <Inner />;
    }
    return {
      ...opts,
      component: Inner ? RoutedPage : Inner,
      useLoaderData: () => {
        const params = useParams() as Record<string, string>;
        return opts.loader ? opts.loader({ params }) : params;
      },
      useParams,
    };
  };
}

export function createRootRoute(opts: unknown) {
  return opts;
}

export class NotFoundError extends Error {
  name = "NotFoundError";
  constructor() {
    super("Not Found");
  }
}

export function notFound(): never {
  throw new NotFoundError();
}

export function HeadContent() {
  return null;
}

export function Scripts() {
  return null;
}

export function useNavigateRouter() {
  return useNavigate();
}

export function useRouterState() {
  const loc = useLocation();
  return { location: loc };
}
