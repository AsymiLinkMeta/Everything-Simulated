import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, staffListProfiles, staffSetRole } from "@/lib/es/server";
import type { StaffRole } from "@/lib/es/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff/team")({
  component: Team,
});

const ROLES: StaffRole[] = ["customer", "sales", "workshop", "content", "support", "admin"];

function Team() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const people = useQuery({
    queryKey: ["profiles"],
    queryFn: () => staffListProfiles(),
    enabled: me.data?.role === "admin",
  });

  if (me.data && me.data.role !== "admin") {
    return <p className="text-sm text-muted">Admin only.</p>;
  }

  async function setRole(userId: string, role: StaffRole) {
    try {
      await staffSetRole({ data: { userId, role } });
      toast.success("Role updated");
      await qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch {
      toast.error("Could not update role");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Admin</p>
        <h1 className="mt-2 text-3xl font-medium">Team</h1>
        <p className="mt-2 text-sm text-muted">The first account on this install is admin.</p>
      </div>
      <ul className="space-y-3">
        {people.data?.map((p) => (
          <li key={p.user_id} className="es-card p-4">
            <p className="font-medium">{p.display_name ?? p.email ?? p.user_id}</p>
            <p className="text-xs text-muted">{p.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={p.role === r ? "primary" : "outline"}
                  onClick={() => setRole(p.user_id, r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
