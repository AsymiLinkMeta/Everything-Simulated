import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMyBookings, requestBooking } from "@/lib/es/server";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/app/book")({
  component: Book,
});

function Book() {
  const qc = useQueryClient();
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings() });
  const [kind, setKind] = useState("demo");
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestBooking({ data: { kind, slot, notes } });
      toast.success("Booking requested");
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
          Preferred slot
          <Input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Sat 10:00" />
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
