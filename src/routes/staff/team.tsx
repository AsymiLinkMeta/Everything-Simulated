import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { getProfile, staffListProfiles, staffSetRole } from "@/lib/es/server";
import { createStaffAccount, type CreatableStaffRole } from "@/lib/es/staff-accounts";
import type { StaffRole } from "@/lib/es/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/team")({
  component: Team,
});

const ROLES: StaffRole[] = ["customer", "sales", "workshop", "content", "support", "admin"];
const STAFF_ROLES: CreatableStaffRole[] = ["sales", "workshop", "content", "support", "admin"];

type NewStaff = {
  displayName: string;
  email: string;
  role: CreatableStaffRole;
  password: string;
  confirmPassword: string;
};

const EMPTY_FORM: NewStaff = {
  displayName: "",
  email: "",
  role: "workshop",
  password: "",
  confirmPassword: "",
};

function Team() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const people = useQuery({
    queryKey: ["profiles"],
    queryFn: () => staffListProfiles(),
    enabled: me.data?.role === "admin",
  });
  const [form, setForm] = useState<NewStaff>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  if (me.data && me.data.role !== "admin") {
    return <p className="text-sm text-muted">Admin only.</p>;
  }

  async function setRole(userId: string, role: StaffRole) {
    try {
      await staffSetRole({ userId, role });
      toast.success("Role updated");
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Could not update role");
    }
  }

  async function createAccount() {
    if (!form.displayName.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setCreating(true);
    try {
      await createStaffAccount({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
      });
      toast.success(`${form.displayName.trim()} can now sign in`);
      setForm(EMPTY_FORM);
      setShowPassword(false);
      await qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create staff account");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Admin</p>
        <h1 className="mt-2 text-3xl font-medium">Team</h1>
        <p className="mt-2 text-sm text-muted">Create staff logins, assign access, and manage the team.</p>
      </div>

      <section className="es-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-esred/15 text-esred">
            <UserPlus className="size-4" />
          </div>
          <div>
            <h2 className="font-medium">Add staff member</h2>
            <p className="mt-1 text-sm text-muted">Create a login and assign their staff access in one step.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted">Full name</span>
            <Input
              value={form.displayName}
              onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))}
              placeholder="Alex Smith"
              autoComplete="name"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Email address</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              placeholder="alex@example.com"
              autoComplete="email"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Staff role</span>
            <select
              className="es-input"
              value={form.role}
              onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as CreatableStaffRole }))}
            >
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Temporary password</span>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-paper"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted">Confirm password</span>
            <Input
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => setForm((current) => ({ ...current, confirmPassword: e.target.value }))}
              placeholder="Repeat the temporary password"
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={createAccount} disabled={creating}>
            <UserPlus className="size-4" />
            {creating ? "Creating account…" : "Create staff account"}
          </Button>
          <p className="text-xs text-muted">The account is confirmed immediately and can sign in with these details.</p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Current team</h2>
            <p className="mt-1 text-sm text-muted">Change access below. Admin accounts can manage this page.</p>
          </div>
          {people.data ? <span className="text-sm text-muted">{people.data.length} account{people.data.length === 1 ? "" : "s"}</span> : null}
        </div>
        {people.isPending ? (
          <div className="mt-3 es-card p-4 text-sm text-muted">Loading team…</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {people.data?.map((p) => (
              <li key={p.user_id} className="es-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.display_name ?? p.email ?? p.user_id}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </div>
                  <span className="rounded-md bg-raised px-2 py-1 text-xs capitalize text-muted">{p.role}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <Button
                      key={role}
                      size="sm"
                      variant={p.role === role ? "primary" : "outline"}
                      onClick={() => setRole(p.user_id, role)}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
