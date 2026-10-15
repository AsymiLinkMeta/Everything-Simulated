import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { getProfile } from "@/lib/es/server";
import {
  TRUST_KEYS,
  fetchTrustSettings,
  saveTrustSettings,
  trustItems,
  validateTrustSetting,
  type TrustKey,
  type TrustSettings,
} from "@/lib/es/site-settings";
import { TrustBarView } from "@/components/es/trust-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/site")({
  component: SiteSettings,
});

const FIELDS: Record<TrustKey, { label: string; hint: string; placeholder: string }> = {
  trust_try_before: {
    label: "Try before you buy",
    hint: "What a customer can do before paying.",
    placeholder: "e.g. Drive any rig at the Gold Coast workshop",
  },
  trust_lead_time: {
    label: "Typical lead time",
    hint: "Build and ship time you are happy to stand behind.",
    placeholder: "e.g. 2–4 weeks",
  },
  trust_warranty: {
    label: "Warranty",
    hint: "Only what you actually offer.",
    placeholder: "e.g. 12-month workshop warranty",
  },
  trust_google_rating: {
    label: "Google rating",
    hint: "From your Google Business profile, 0–5.",
    placeholder: "e.g. 4.9",
  },
  trust_google_review_count: {
    label: "Google review count",
    hint: "Whole number. Shown with the rating.",
    placeholder: "e.g. 120",
  },
  trust_google_reviews_url: {
    label: "Google reviews link",
    hint: "https:// link to your reviews. Makes the rating clickable.",
    placeholder: "https://g.page/…",
  },
};

function SiteSettings() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const settings = useQuery({ queryKey: ["site-settings"], queryFn: fetchTrustSettings });
  const [form, setForm] = useState<TrustSettings>({});
  const [saving, setSaving] = useState(false);
  const isAdmin = me.data?.role === "admin";

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (me.data && !me.data.isStaff) return <p className="text-sm text-muted">Staff only.</p>;

  const errors = Object.fromEntries(TRUST_KEYS.map((k) => [k, validateTrustSetting(k, form[k] ?? "")])) as Record<TrustKey, string | null>;
  const invalid = TRUST_KEYS.some((k) => errors[k]);
  const preview = trustItems(form);

  async function save() {
    setSaving(true);
    try {
      await saveTrustSettings(form);
      toast.success("Site settings saved");
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Site settings</h1>
        <p className="mt-1 text-sm text-muted">
          The trust bar on the home, prebuild and checkout pages. Leave a field empty and it is not shown. Nothing is filled in
          for you.
        </p>
      </div>
      {!isAdmin && me.data ? <p className="text-sm text-muted">Only an admin can change these.</p> : null}
      <form
        className="es-card grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) void save();
        }}
      >
        {TRUST_KEYS.map((k) => (
          <label key={k} className="grid gap-1 text-sm">
            <span className="font-medium">{FIELDS[k].label}</span>
            <Input
              name={k}
              value={form[k] ?? ""}
              placeholder={FIELDS[k].placeholder}
              maxLength={160}
              disabled={!isAdmin}
              aria-invalid={errors[k] ? true : undefined}
              aria-describedby={`${k}-hint`}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
            <span id={`${k}-hint`} className={errors[k] ? "text-xs text-esred" : "text-xs text-subtle"}>
              {errors[k] ?? FIELDS[k].hint}
            </span>
          </label>
        ))}
        <div>
          <Button type="submit" disabled={!isAdmin || saving || invalid}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
      <section className="space-y-2">
        <p className="es-kicker">Preview</p>
        {preview.length ? <TrustBarView items={preview} /> : <p className="text-sm text-muted">Nothing set, so the bar is hidden.</p>}
      </section>
    </div>
  );
}

