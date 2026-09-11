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

export function applyHeadPayload(head: unknown) {
  if (!head || typeof head !== "object") return;
  const h = head as { meta?: Array<Record<string, string>>; links?: Array<Record<string, string>> };
  let description = "";
  for (const m of h.meta ?? []) {
    if (m.title) document.title = m.title;
    if (m.name && m.content) {
      setMeta("meta", "name", m.name, m.content);
      if (m.name === "description") description = m.content;
    }
    if (m.property && m.content) setMeta("meta", "property", m.property, m.content);
  }
  for (const l of h.links ?? []) {
    if (l.rel && l.href) setMeta("link", "rel", l.rel, l.href);
  }
  const origin = window.location.origin;
  const url = `${origin}${window.location.pathname}`;
  setMeta("meta", "property", "og:title", document.title);
  if (description) setMeta("meta", "property", "og:description", description);
  setMeta("meta", "property", "og:url", url);
  setMeta("meta", "property", "og:image", `${origin}/og.jpg`);
  setMeta("meta", "name", "twitter:card", "summary_large_image");
  setMeta("meta", "name", "twitter:image", `${origin}/og.jpg`);
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
