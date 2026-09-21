import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AGE_BANDS, ambassadorLink, type AgeBand, type AmbassadorDraft } from "@/lib/es/ambassadors";
import { fetchMyAmbassador, saveMyAmbassador } from "@/lib/es/ambassador-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/ambassador")({
  component: AmbassadorStudio,
});

type FormState = AmbassadorDraft;

const EMPTY: FormState = {
  name: "",
  photo: "",
  bio: "",
  motorsport: "",
  series: "",
  className: "",
  teamStatus: "",
  base: "",
  ageBand: "",
  crate: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  facebook: "",
  under18: false,
};

function AmbassadorStudio() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-ambassador"], queryFn: fetchMyAmbassador });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mine.data) return;
    setForm({
      name: mine.data.name,
      photo: mine.data.photo ?? "",
      bio: mine.data.bio,
      motorsport: mine.data.motorsport ?? "",
      series: mine.data.series ?? "",
      className: mine.data.className ?? "",
      teamStatus: mine.data.teamStatus ?? "",
      base: mine.data.base ?? "",
      ageBand: mine.data.ageBand ?? "",
      crate: mine.data.crate ?? "",
      instagram: mine.data.social?.instagram ?? "",
      tiktok: mine.data.social?.tiktok ?? "",
      youtube: mine.data.social?.youtube ?? "",
      facebook: mine.data.social?.facebook ?? "",
      under18: mine.data.under18,
    });
  }, [mine.data]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await saveMyAmbassador({
        ...form,
        under18: form.under18 || (form.ageBand !== "" && form.ageBand !== "18+"),
      });
      toast.success("Saved. Staff publish the live card.");
      await qc.invalidateQueries({ queryKey: ["my-ambassador"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (mine.isPending) return <p className="text-sm text-muted">Opening your card…</p>;

  if (!mine.data) {
    return (
      <div className="es-card max-w-xl space-y-3 p-6">
        <p className="es-kicker">Ambassador</p>
        <h1 className="text-2xl font-medium">No seat on this login yet</h1>
        <p className="text-sm text-muted">
          The workshop issues the profile and the code, then attaches this account. Ask Taylah or the staff desk.
        </p>
        <Button asChild variant="outline">
          <Link to="/contact">Contact the workshop</Link>
        </Button>
      </div>
    );
  }

  const junior = form.under18 || (form.ageBand !== "" && form.ageBand !== "18+");

  return (
    <form className="mx-auto max-w-2xl space-y-6" onSubmit={onSave}>
      <div>
        <p className="es-kicker">Ambassador</p>
        <h1 className="mt-2 text-3xl font-medium">Your racing card</h1>
        <p className="mt-2 text-sm text-muted">
          Type the motorsport, series and class you actually run. Saving unpublishes the public card until staff review it.
          Code <strong className="text-paper">{mine.data.code}</strong> ·{" "}
          {mine.data.published ? "Live on the site" : "Waiting for staff to publish"}.
        </p>
        <p className="mt-2 text-xs text-muted">
          Share link: {typeof window !== "undefined" ? window.location.origin : ""}
          {ambassadorLink(mine.data.code)}
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-muted">Name</span>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-muted">Photo URL</span>
        <Input value={form.photo} onChange={(e) => setForm((f) => ({ ...f, photo: e.target.value }))} placeholder="https://…" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-muted">Bio</span>
        <textarea
          rows={4}
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-muted">Motorsport</span>
          <Input value={form.motorsport} onChange={(e) => setForm((f) => ({ ...f, motorsport: e.target.value }))} placeholder="Carrera Cup, kart, sprint…" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Series</span>
          <Input value={form.series} onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Class</span>
          <Input value={form.className} onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Team / status</span>
          <Input value={form.teamStatus} onChange={(e) => setForm((f) => ({ ...f, teamStatus: e.target.value }))} placeholder="Privateer, works…" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Base</span>
          <Input value={form.base} onChange={(e) => setForm((f) => ({ ...f, base: e.target.value }))} placeholder="Gold Coast" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Age band</span>
          <select
            className="es-input w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            value={form.ageBand ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, ageBand: e.target.value as AgeBand | "" }))}
          >
            <option value="">Prefer not to say</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      {junior ? (
        <label className="flex items-start gap-3 rounded-lg border border-line px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.under18}
            onChange={(e) => setForm((f) => ({ ...f, under18: e.target.checked }))}
          />
          <span>This login is the parent or guardian. Date of birth stays off the site. Staff must approve before publish.</span>
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-muted">Instagram</span>
          <Input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">TikTok</span>
          <Input value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">YouTube</span>
          <Input value={form.youtube} onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Facebook</span>
          <Input value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
        </label>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save draft for review"}
      </Button>
    </form>
  );
}
