/**
 * Lazy wrapper around sonner. The toast library (~10 KB gzip) is not needed for first paint,
 * so it loads after the page has settled, or as soon as something calls toast().
 * Same call shapes as sonner: toast(msg), toast.success / error / message(msg, opts).
 */
import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

type Sonner = typeof import("sonner");
type Msg = Parameters<Sonner["toast"]["success"]>[0];
type Opts = Parameters<Sonner["toast"]["success"]>[1];

let sonner: Promise<Sonner> | null = null;
const loadSonner = () => (sonner ??= import("sonner"));

let markReady: () => void = () => {};
const ready = new Promise<void>((resolve) => (markReady = resolve));
let requestMount: () => void = () => {};

function call(kind: "default" | "success" | "error" | "message", msg: Msg, opts?: Opts) {
  requestMount();
  void Promise.all([loadSonner(), ready]).then(([m]) => (kind === "default" ? m.toast(msg, opts) : m.toast[kind](msg, opts)));
}

export const toast = Object.assign((msg: Msg, opts?: Opts) => call("default", msg, opts), {
  success: (msg: Msg, opts?: Opts) => call("success", msg, opts),
  error: (msg: Msg, opts?: Opts) => call("error", msg, opts),
  message: (msg: Msg, opts?: Opts) => call("message", msg, opts),
});

type ToasterProps = Omit<ComponentProps<Sonner["Toaster"]>, "ref">;

const RealToaster = lazy(async () => {
  const m = await loadSonner();
  function Mounted(props: ToasterProps) {
    useEffect(() => markReady(), []);
    return <m.Toaster {...props} />;
  }
  return { default: Mounted };
});

/** Mounts sonner's Toaster after load + idle, or immediately when a toast is requested. */
export function LazyToaster(props: ToasterProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestMount = () => setMounted(true);
    const start = () => setTimeout(() => setMounted(true), 3000);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <RealToaster {...props} />
    </Suspense>
  );
}
