import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffListBookings, staffSetBookingStatus } from "@/lib/es/server";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/staff/bookings")({
  component: Bookings,
});

function Bookings() {
  const qc = useQueryClient();
  const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });

  async function setStatus(id: number, status: "confirmed" | "cancelled" | "requested") {
    try {
      await staffSetBookingStatus(id, status);
      await qc.invalidateQueries({ queryKey: ["staff-bookings"] });
      toast.success(status === "confirmed" ? "Confirmed" : "Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Studio</p>
        <h1 className="mt-2 text-3xl font-medium">Bookings</h1>
      </div>
      {bookings.isPending ? (
        <ul className="space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="es-card p-4 text-sm text-muted">
              Loading…
            </li>
          ))}
        </ul>
      ) : !bookings.data?.length ? (
        <div className="es-card p-6 text-center">
          <Calendar className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No bookings yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {bookings.data.map((b) => (
            <li key={b.id} className="es-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium capitalize">{b.kind}</p>
                <span
                  className="rounded-md px-2 py-0.5 text-xs capitalize"
                  style={{
                    background: b.status === "confirmed" ? "rgba(61,154,106,0.15)" : "rgba(196,161,90,0.15)",
                    color: b.status === "confirmed" ? "var(--es-ok)" : "var(--es-warn)",
                  }}
                >
                  {b.status}
                </span>
              </div>
              <p className="mt-1 text-muted">
                {b.customer ? `${b.customer} · ` : ""}
                {b.slot ?? "unscheduled"} · {b.notes || "No notes"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.status !== "confirmed" ? (
                  <Button size="sm" onClick={() => void setStatus(b.id, "confirmed")}>
                    Confirm
                  </Button>
                ) : null}
                {b.status !== "cancelled" ? (
                  <Button size="sm" variant="outline" onClick={() => void setStatus(b.id, "cancelled")}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
