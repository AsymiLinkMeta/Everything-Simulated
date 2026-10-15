import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead } from "@/lib/es/seo";
import { confirmGuardian, guardianLinkInfo } from "@/lib/es/ambassadors";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_site/guardian")({
  head: () =>
    pageHead({
      title: "Guardian approval | Everything Simulated",
      description: "Approve or decline a young driver's Everything Simulated ambassador profile.",
      path: "/guardian",
      index: false,
    }),
  component: GuardianPage,
});

type State =
  | { k: "loading" }
  | { k: "invalid" }
  | { k: "error"; message: string }
  | { k: "ready"; info: { ambassador_name: string; guardian_name: string; expires: string } }
  | { k: "done"; approved: boolean; name: string };

/** The token travels in the URL fragment (#t=...) so it never reaches server logs or Referer headers. */
function readToken() {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,128})/.exec(window.location.hash);
  return m?.[1] ?? null;
}

function GuardianPage() {
  const [token] = useState(readToken);
  const [state, setState] = useState<State>({ k: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return setState({ k: "invalid" });
    guardianLinkInfo(token)
      .then((info) => setState(info ? { k: "ready", info } : { k: "invalid" }))
      .catch((e) => setState({ k: "error", message: e instanceof Error ? e.message : "Something went wrong" }));
  }, [token]);

  async function decide(approve: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await confirmGuardian(token, approve);
      setState({ k: "done", approved: r.approved, name: r.ambassador_name });
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      setState({ k: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="es-container max-w-xl py-16" aria-live="polite">
      <p className="es-kicker">Ambassador programme</p>
      <h1 className="mt-2 text-3xl font-medium">Guardian approval</h1>
      {state.k === "loading" && <div className="es-card mt-6 h-32 animate-pulse" aria-label="Loading" />}
      {state.k === "invalid" && (
        <p className="mt-6 text-muted">
          This link has expired or has already been used. Ask the driver or the workshop to send a new one, or{" "}
          <Link to="/contact" className="underline">contact us</Link>.
        </p>
      )}
      {state.k === "error" && (
        <p role="alert" className="mt-6 text-red-400">{state.message}</p>
      )}
      {state.k === "ready" && (
        <div className="es-card mt-6 space-y-4 p-6">
          <p>
            Hi {state.info.guardian_name}. <strong>{state.info.ambassador_name}</strong> would like a public ambassador profile on
            Everything Simulated. The profile shows their name, photo, bio, racing details and social links, plus a referral code.
            Commission earned on referred orders is only paid out once you have approved.
          </p>
          <p className="text-sm text-muted">
            This link works until {new Date(state.info.expires).toLocaleDateString("en-AU", { dateStyle: "long" })}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={() => void decide(true)}>I approve</Button>
            <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>I don't approve</Button>
          </div>
        </div>
      )}
      {state.k === "done" && (
        <p className="mt-6" data-testid="guardian-done">
          {state.approved
            ? `Thanks. ${state.name}'s profile is approved; the workshop can now publish it.`
            : `Thanks. ${state.name}'s profile will stay private. The workshop will be in touch.`}
        </p>
      )}
    </section>
  );
}
