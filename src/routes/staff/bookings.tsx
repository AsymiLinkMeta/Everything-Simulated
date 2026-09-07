import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffListBookings } from "@/lib/es/server";

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
      <ul className="space-y-2">
        {bookings.data?.map((b) => (
          <li key={b.id} className="es-card p-4 text-sm">
            <p className="font-medium capitalize">
              {b.kind} · {b.status}
            </p>
            <p className="text-muted">
              {b.slot ?? "unscheduled"} · {b.notes || "No notes"}
            </p>
          </li>
        ))}
        {bookings.data?.length === 0 ? <li className="text-sm text-muted">No bookings yet.</li> : null}
      </ul>
    </div>
  );
}
