import type { CSSProperties, ReactNode } from "react";
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

export function createFileRoute(_path: string) {
  return (opts: {
    component?: React.ComponentType;
    loader?: (ctx: { params: Record<string, string> }) => unknown;
    head?: unknown;
    notFoundComponent?: React.ComponentType;
  }) => {
    return {
      ...opts,
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

export function notFound() {
  throw new Error("Not Found");
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
