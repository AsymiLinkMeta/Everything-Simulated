import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMyBookings, requestBooking } from "@/lib/es/server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/app/book")({
  component: Book,
});

function studioSlots() {
  const out: string[] = [];
  const times = ["10:00", "13:00", "16:00"];
  for (let d = 1; d <= 21; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    if (date.getDay() === 0) continue;
    const label = date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
    for (const t of times) out.push(`${label} ${t}`);
  }
  return out;
}

function Book() {
  const qc = useQueryClient();
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings() });
  const slots = useMemo(() => studioSlots(), []);
  const [kind, setKind] = useState("demo");
  const [slot, setSlot] = useState(slots[0] ?? "");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestBooking({ kind, slot, notes });
      toast.success("Booking requested — the workshop will confirm in Messages.");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch {
      toast.error("Could not request booking");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Studio</p>
        <h1 className="mt-2 text-3xl font-medium">Book the Gold Coast</h1>
        <p className="mt-2 text-sm text-muted">Weekdays and Saturday. Closed Sunday. Staff confirm the slot in the inbox.</p>
      </div>
      <form className="es-card space-y-4 p-5" onSubmit={submit}>
        <label className="block text-sm">
          Type
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-raised px-3 text-paper"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="demo">Showroom demo</option>
            <option value="install">Install / calibration</option>
            <option value="support">Support</option>
          </select>
        </label>
        <label className="block text-sm">
          Slot
          <select
            required
            className="mt-1 min-h-11 w-full rounded-md border border-line bg-raised px-3 text-paper"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Notes
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Driver height, juniors, existing PC…" />
        </label>
        <Button type="submit">Request booking</Button>
      </form>
      <ul className="space-y-2">
        {bookings.data?.map((b) => (
          <li key={b.id} className="es-card px-4 py-3 text-sm">
            {b.kind} · {b.slot ?? "TBC"} · {b.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
