import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/es/qr-code";
import { LoadError } from "@/components/es/bits";
import {
  ambassadorShareUrl,
  fetchAmbassadorDashboard,
  sendGuardianEmail,
  setGuardian,
  staffGuardianDecline,
  staffGuardianSignoff,
  type AmbassadorDashboard,
  type GuardianStatus,
} from "@/lib/es/ambassadors";
import { aud, audExact } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending: deposit paid",
  approved: "Approved: paid in full",
  paid: "Paid out",
  void: "Void",
};

function pct(rate: number | null) {
  return rate === null ? "not set" : `${(rate * 100).toFixed(rate * 100 < 10 ? 1 : 0).replace(/\.0$/, "")}%`;
}

/** Clicks, leads, sales and earnings for one ambassador (their own, or any for staff). */
export function AmbassadorDashboardPanel({ ambassadorId, staff = false }: { ambassadorId?: string; staff?: boolean }) {
  const [days, setDays] = useState(90);
  const q = useQuery({
    queryKey: ["ambassador-dashboard", ambassadorId ?? "me", days],
    queryFn: () => fetchAmbassadorDashboard(ambassadorId ?? null, days),
  });

  if (q.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading your numbers">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="es-card h-24 animate-pulse" />
        ))}
      </div>
    );
  }
  if (q.isError) return <LoadError what="the dashboard" onRetry={() => void q.refetch()} />;
  const d = q.data;
  if (!d) return <p className="text-sm text-muted">No ambassador profile is linked to this account.</p>;

  return (
    <section className="space-y-4" aria-labelledby="amb-dash-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="amb-dash-h" className="text-lg font-medium">
          {staff ? `${d.ambassador.name}: performance` : "Your numbers"}
        </h2>
        <label className="text-xs text-muted">
          Period{" "}
          <select
            className="ml-1 rounded-md border border-line bg-ink px-2 py-1 text-sm text-paper"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </label>
      </div>
      {d.rate_source === "unset" ? (
        <p role="status" className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          {staff
            ? "No commission rate is set for this ambassador and there is no default rate. Sales are tracked; amounts are calculated once a rate is set."
            : "Your commission rate hasn't been set yet. Every sale is still tracked and will be calculated once the workshop sets it."}
        </p>
      ) : null}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ambassador-stats">
        <Stat label="Clicks" value={String(d.clicks)} hint={`${d.visitors} unique visitors`} />
        <Stat label="Leads" value={String(d.leads)} hint="Saved quotes and enquiries" />
        <Stat label="Sales" value={String(d.sales)} hint={`${aud(d.sales_ex_gst)} ex GST`} />
        <Stat
          label="Earnings"
          value={audExact(d.earnings.pending + d.earnings.approved + d.earnings.paid)}
          hint={`Rate ${pct(d.rate)}${d.rate_source === "default" ? " (default)" : ""}${d.earnings.uncalculated ? ` · ${d.earnings.uncalculated} not calculated` : ""}`}
        />
      </dl>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Stat small label="Pending (deposit paid)" value={audExact(d.earnings.pending)} />
        <Stat small label="Approved (ready to pay)" value={audExact(d.earnings.approved)} />
        <Stat small label="Paid out" value={audExact(d.earnings.paid)} />
      </dl>
      <CommissionList d={d} />
    </section>
  );
}

function Stat({ label, value, hint, small }: { label: string; value: string; hint?: string; small?: boolean }) {
  return (
    <div className={`es-card ${small ? "p-3" : "p-4"}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`${small ? "text-base" : "text-2xl"} font-medium tabular-nums`}>{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

function CommissionList({ d }: { d: AmbassadorDashboard }) {
  if (!d.commissions.length) {
    return <p className="text-sm text-muted">No referred orders yet. Share your link or QR code to get started.</p>;
  }
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Referred orders">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Referred orders and commission</caption>
        <thead className="text-muted">
          <tr>
            <th className="py-2">Order</th>
            <th>Date</th>
            <th>Sale ex GST</th>
            <th>Commission</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {d.commissions.map((c) => (
            <tr key={`${c.ref}-${c.date}`} className="border-t border-line">
              <td className="py-2 font-mono text-xs">{c.ref}</td>
              <td>{new Date(c.date).toLocaleDateString("en-AU")}</td>
              <td className="tabular-nums">{aud(c.basis_ex_gst)}</td>
              <td className="tabular-nums">{c.amount_cents === null ? <span className="text-muted">Not calculated</span> : audExact(c.amount_cents)}</td>
              <td>
                {STATUS_LABEL[c.status] ?? c.status}
                {c.void_reason ? <span className="block text-xs text-muted">{c.void_reason}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Link, code and QR (PNG/SVG) an ambassador shares. */
export function ShareKit({ code, slug, name }: { code: string; slug: string; name: string }) {
  const url = ambassadorShareUrl({ code, slug });
  return (
    <section className="es-card space-y-3 p-5" aria-labelledby="share-h">
      <h2 id="share-h" className="text-lg font-medium">Share kit</h2>
      <p className="text-sm text-muted">
        Anyone who opens your link or scans your QR code is credited to you for 90 days (the last ambassador link they
        used counts). Customers can also enter code <strong>{code}</strong> at checkout. It isn't a discount.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input readOnly value={url} aria-label="Your referral link" className="max-w-md font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Link copied");
            } catch {
              toast.error("Copy failed. Select the link and copy it.");
            }
          }}
        >
          Copy link
        </Button>
      </div>
      <QrCode url={url} size={180} filename={`es-ambassador-${slug}`} label={`Referral QR code for ${name}`} />
    </section>
  );
}

/** Guardian approval for under-18 ambassadors. Staff see sign-off controls. */
export function GuardianCard({
  ambassadorId,
  guardian,
  staff = false,
  onChanged,
}: {
  ambassadorId: string;
  guardian: GuardianStatus;
  staff?: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(guardian.guardian_name);
  const [email, setEmail] = useState(guardian.guardian_email);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!guardian.required) return null;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
      await qc.invalidateQueries({ queryKey: ["staff-guardians"] });
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const statusText =
    guardian.status === "approved"
      ? `Approved${guardian.method === "email" ? " by email" : " by the workshop"}${guardian.decided_at ? ` on ${new Date(guardian.decided_at).toLocaleDateString("en-AU")}` : ""}.`
      : guardian.status === "declined"
        ? "Declined. The profile stays private."
        : guardian.configured_method === "email"
          ? guardian.link_pending
            ? "Waiting for the guardian to open the approval link."
            : "Waiting for guardian approval. Send them the approval email."
          : "Waiting for the workshop to record the guardian's approval.";

  return (
    <section className="es-card space-y-3 p-5" aria-labelledby={`guardian-h-${ambassadorId}`} data-testid="guardian-card">
      <h2 id={`guardian-h-${ambassadorId}`} className="text-lg font-medium">Parent or guardian approval</h2>
      <p className="text-sm text-muted">
        Under-18 ambassadors need a parent or guardian to approve before the profile goes public or any commission is paid.
      </p>
      <p role="status" className={`text-sm ${guardian.status === "approved" ? "text-ok" : guardian.status === "declined" ? "text-red-300" : "text-warn"}`}>
        {statusText}
      </p>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => setGuardian(ambassadorId, name, email), "Guardian details saved");
        }}
      >
        <label className="text-xs text-muted">
          Guardian name
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="off" />
        </label>
        <label className="text-xs text-muted">
          Guardian email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={busy} className="self-end">
          Save
        </Button>
      </form>
      {guardian.configured_method === "email" && guardian.status !== "approved" ? (
        <Button
          size="sm"
          disabled={busy || !guardian.guardian_email}
          onClick={() => void run(() => sendGuardianEmail(ambassadorId), `Approval email sent to ${guardian.guardian_email}`)}
        >
          {guardian.link_pending ? "Resend approval email" : "Send approval email"}
        </Button>
      ) : null}
      {staff && guardian.status !== "approved" ? (
        <div className="space-y-2 border-t border-line pt-3">
          <label className="block text-xs text-muted">
            How did the guardian approve? (required for sign-off)
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Signed consent form, filed 15/10" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || note.trim().length < 3} onClick={() => void run(() => staffGuardianSignoff(ambassadorId, note), "Guardian approval recorded")}>
              Record guardian approval
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => staffGuardianDecline(ambassadorId, note), "Marked as declined")}>
              Guardian declined
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
