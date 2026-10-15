import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffRecordPayment } from "@/lib/es/crm-oms";
import { audExact } from "@/lib/utils";

/**
 * "Mark paid" for money received outside Stripe. Asks how much came in
 * (defaults to the balance owing) so paid_cents stays true; the first payment
 * issues the invoice number.
 */
export function RecordPayment({
  orderId,
  balanceCents,
  onDone,
  label = "Record payment",
}: {
  orderId: string;
  balanceCents: number;
  onDone?: () => void | Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => (Math.max(0, balanceCents) / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAmount((Math.max(0, balanceCents) / 100).toFixed(2));
          setNote("");
          setOpen(true);
        }}
        disabled={balanceCents <= 0}
      >
        {label}
      </Button>
    );
  }

  const cents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
  const invalid = !Number.isFinite(cents) || cents <= 0 || cents > balanceCents;

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-md border border-line p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (invalid) return;
        setBusy(true);
        try {
          const res = await staffRecordPayment(orderId, cents, note);
          toast.success(`Payment recorded${res.invoice_number ? ` · ${res.invoice_number}` : ""}. Balance ${audExact(res.balance_cents)}`);
          setOpen(false);
          await onDone?.();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not record the payment");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs text-muted">
        Amount received, inc GST (balance {audExact(balanceCents)})
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={invalid}
          aria-label={`Amount received for ${orderId}`}
        />
      </label>
      <label className="text-xs text-muted">
        Reference (optional)
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank transfer ref" maxLength={300} />
      </label>
      {invalid ? <p className="text-xs text-red-300">Enter an amount between $0.01 and {audExact(balanceCents)}.</p> : null}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy || invalid}>
          {busy ? "Saving…" : "Save payment"}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
