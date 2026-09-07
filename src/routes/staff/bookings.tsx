import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffListBookings } from "@/lib/es/server";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/staff/bookings")({
  component: Bookings,
});

function Bookings() {
  const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });

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
                {b.slot ?? "unscheduled"} · {b.notes || "No notes"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
