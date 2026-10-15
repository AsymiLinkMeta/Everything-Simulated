import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadError } from "@/components/es/bits";
import {
  commissionsToCsv,
  staffCommissionReport,
  staffFetchProgrammeSettings,
  staffMarkPayout,
  staffSetAmbassadorRate,
  staffSetProgrammeSetting,
  type CommissionReportRow,
  type CommissionStatus,
  type ProgrammeSettings,
} from "@/lib/es/ambassadors";
import { audExact } from "@/lib/utils";

/** "5" or "5%" -> 0.05; "" -> null. Throws on anything else. */
export function parsePercent(raw: string): number | null {
  const t = raw.trim().replace(/%$/, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 50) throw new Error("Enter a percentage between 0 and 50, or leave it empty");
  return Math.round(n * 100) / 10000;
}
const toPercent = (r: number | null | undefined) => (r === null || r === undefined ? "" : String(Math.round(r * 10000) / 100));

export function useProgrammeSettings() {
  return useQuery({ queryKey: ["ambassador-settings"], queryFn: staffFetchProgrammeSettings });
}

/** Shown on every staff ambassador screen while there is no default rate. */
export function DefaultRateWarning({ settings }: { settings?: ProgrammeSettings }) {
  if (!settings || settings.default_commission_rate !== null) return null;
  return (
    <p role="alert" className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-warn" data-testid="default-rate-warning">
      No default commission rate is set, so commissions are recorded without an amount (unless the ambassador has their own
      rate). Set one under Programme settings; every open commission is recalculated straight away.
    </p>
  );
}

export function ProgrammeSettingsPanel() {
  const qc = useQueryClient();
  const s = useProgrammeSettings();
  const [rate, setRate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (s.isPending) return <div className="es-card h-40 animate-pulse" />;
  if (s.isError) return <LoadError what="programme settings" onRetry={() => void s.refetch()} />;
  const v = s.data;

  async function save(key: keyof ProgrammeSettings, value: unknown, ok: string) {
    setBusy(true);
    try {
      const r = await staffSetProgrammeSetting(key, value);
      toast.success(r.recalculated ? `${ok}. ${r.recalculated} open commission${r.recalculated === 1 ? "" : "s"} recalculated.` : ok);
      await qc.invalidateQueries({ queryKey: ["ambassador-settings"] });
      await qc.invalidateQueries({ queryKey: ["ambassador-report"] });
      await qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="prog-h">
      <h2 id="prog-h" className="text-lg font-medium">Programme settings</h2>
      <DefaultRateWarning settings={v} />
      <form
        className="es-card space-y-2 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const r = parsePercent(rate ?? toPercent(v.default_commission_rate));
            void save("default_commission_rate", r, r === null ? "Default rate cleared" : `Default rate set to ${toPercent(r)}%`);
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      >
        <label className="block text-sm">
          Default commission rate (% of the sale ex GST)
          <span className="block text-xs text-muted">Used when an ambassador has no rate of their own. Leave empty for "not set".</span>
          <Input
            className="mt-1 max-w-32"
            inputMode="decimal"
            value={rate ?? toPercent(v.default_commission_rate)}
            onChange={(e) => setRate(e.target.value)}
            placeholder="not set"
            aria-label="Default commission rate percent"
          />
        </label>
        <Button size="sm" type="submit" disabled={busy}>Save default rate</Button>
      </form>

      <div className="es-card space-y-2 p-5">
        <label className="block text-sm">
          Commission basis
          <select
            className="mt-1 block rounded-md border border-line bg-ink px-3 py-2 text-sm"
            value={v.commission_basis}
            disabled={busy}
            onChange={(e) => void save("commission_basis", e.target.value, "Basis saved")}
          >
            <option value="items">Goods only, ex GST</option>
            <option value="items_and_freight">Goods and freight, ex GST</option>
          </select>
        </label>
      </div>

      <div className="es-card space-y-2 p-5">
        <fieldset>
          <legend className="text-sm">Guardian approval for under-18 ambassadors</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="guardian_method" checked={v.guardian_method === "staff"} disabled={busy}
              onChange={() => void save("guardian_method", "staff", "Guardian approval: staff sign-off")} />
            Staff sign-off (the workshop records how the guardian approved)
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="radio" name="guardian_method" checked={v.guardian_method === "email"} disabled={busy}
              onChange={() => void save("guardian_method", "email", "Guardian approval: email link")} />
            Email confirmation link sent to the guardian (valid {v.guardian_link_days} days)
          </label>
        </fieldset>
      </div>
    </section>
  );
}

/** Per-ambassador rate; empty = use the default. */
export function RateEditor({ ambassadorId, rate, defaultRate }: { ambassadorId: string; rate: number | null | undefined; defaultRate: number | null | undefined }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(toPercent(rate));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = parsePercent(value);
          const res = await staffSetAmbassadorRate(ambassadorId, r);
          toast.success(`Rate saved (${res.effective === null ? "not set" : `${toPercent(res.effective)}%`}). ${res.recalculated} open commission(s) updated.`);
          await qc.invalidateQueries({ queryKey: ["ambassador-terms"] });
          await qc.invalidateQueries({ queryKey: ["ambassador-report"] });
          await qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save the rate");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs text-muted">
        Commission %
        <Input
          className="w-24"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={defaultRate === null || defaultRate === undefined ? "not set" : `default ${toPercent(defaultRate)}`}
          aria-label="Commission rate percent"
        />
      </label>
      <Button size="sm" variant="outline" type="submit" disabled={busy}>Save rate</Button>
    </form>
  );
}

const STATUSES: (CommissionStatus | "")[] = ["", "pending", "approved", "paid", "void"];

/** Commissions report with CSV export and "mark paid" payouts. */
export function PayoutsPanel() {
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<CommissionStatus | "">("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const settings = useProgrammeSettings();
  const report = useQuery({
    queryKey: ["ambassador-report", from, to, status],
    queryFn: () => staffCommissionReport({ from, to, status }),
  });
  const rows = useMemo(() => report.data ?? [], [report.data]);
  const pickedRows = rows.filter((r) => picked.has(r.commission_id));
  const pickedAmb = new Set(pickedRows.map((r) => r.ambassador_id));
  const pickedTotal = pickedRows.reduce((t, r) => t + (r.amount_cents ?? 0), 0);

  const owing = useMemo(() => {
    const m = new Map<string, { name: string; approved: number; pending: number; uncalculated: number }>();
    for (const r of rows) {
      const e = m.get(r.ambassador_id) ?? { name: r.ambassador_name, approved: 0, pending: 0, uncalculated: 0 };
      if (r.status === "approved") e.approved += r.amount_cents ?? 0;
      if (r.status === "pending") e.pending += r.amount_cents ?? 0;
      if ((r.status === "approved" || r.status === "pending") && r.amount_cents === null) e.uncalculated += 1;
      m.set(r.ambassador_id, e);
    }
    return [...m.entries()];
  }, [rows]);

  function exportCsv() {
    const blob = new Blob([commissionsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ambassador-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function payout() {
    const [amb] = [...pickedAmb];
    setBusy(true);
    try {
      const res = await staffMarkPayout(amb, [...picked], reference);
      toast.success(`Payout recorded: ${res.count} commission${res.count === 1 ? "" : "s"}, ${audExact(res.total_cents)}`);
      setPicked(new Set());
      setReference("");
      await qc.invalidateQueries({ queryKey: ["ambassador-report"] });
      await qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the payout");
    } finally {
      setBusy(false);
    }
  }

  const selectable = (r: CommissionReportRow) => r.status === "approved" && r.amount_cents !== null && r.guardian_ok;

  return (
    <section className="space-y-4" aria-labelledby="payouts-h">
      <h2 id="payouts-h" className="text-lg font-medium">Commissions and payouts</h2>
      <DefaultRateWarning settings={settings.data} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-xs text-muted">
          Status
          <select className="mt-1 block rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper" value={status} onChange={(e) => setStatus(e.target.value as CommissionStatus | "")}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </label>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>

      {report.isPending ? (
        <div className="es-card h-32 animate-pulse" />
      ) : report.isError ? (
        <LoadError what="the commissions report" onRetry={() => void report.refetch()} />
      ) : !rows.length ? (
        <p className="text-sm text-muted">No commissions in this period. They appear when a referred order's deposit is paid.</p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {owing.map(([id, e]) => (
              <li key={id} className="es-card p-3 text-sm">
                <p className="font-medium">{e.name}</p>
                <p className="text-muted">Ready to pay {audExact(e.approved)} · pending {audExact(e.pending)}</p>
                {e.uncalculated ? <p className="text-xs text-warn">{e.uncalculated} without a rate</p> : null}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Commissions table">
            <table className="w-full text-left text-sm" data-testid="commission-report">
              <caption className="sr-only">Ambassador commissions</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-2"><span className="sr-only">Select</span></th>
                  <th>Ambassador</th><th>Order</th><th>Date</th><th>Basis ex GST</th><th>Rate</th><th>Commission</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.commission_id} className="border-t border-line">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select commission on ${r.order_id}`}
                        disabled={!selectable(r) || (pickedAmb.size > 0 && !pickedAmb.has(r.ambassador_id))}
                        checked={picked.has(r.commission_id)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(r.commission_id); else next.delete(r.commission_id);
                          setPicked(next);
                        }}
                      />
                    </td>
                    <td>{r.ambassador_name} <span className="text-xs text-muted">{r.ambassador_code}</span></td>
                    <td className="font-mono text-xs">{r.order_id}{r.invoice_number ? <span className="block text-muted">{r.invoice_number}</span> : null}</td>
                    <td>{new Date(r.order_date).toLocaleDateString("en-AU")}</td>
                    <td className="tabular-nums">{audExact(r.basis_ex_gst)}</td>
                    <td>{r.rate === null ? <span className="text-warn">not set</span> : `${toPercent(r.rate)}%`}</td>
                    <td className="tabular-nums">{r.amount_cents === null ? "—" : audExact(r.amount_cents)}</td>
                    <td>
                      {r.status}
                      {r.void_reason ? <span className="block text-xs text-muted">{r.void_reason}</span> : null}
                      {r.payout_reference ? <span className="block text-xs text-muted">ref {r.payout_reference}</span> : null}
                      {!r.guardian_ok && r.status === "approved" ? <span className="block text-xs text-warn">guardian approval needed</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="es-card flex flex-wrap items-end gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void payout();
            }}
          >
            <p className="text-sm">
              {picked.size ? `${picked.size} selected · ${audExact(pickedTotal)}` : "Select approved commissions for one ambassador to record a payout."}
            </p>
            <label className="text-xs text-muted">
              Payment reference
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. EFT 15/10" />
            </label>
            <Button size="sm" type="submit" disabled={busy || !picked.size || reference.trim().length < 2}>Mark paid</Button>
          </form>
        </>
      )}
    </section>
  );
}
