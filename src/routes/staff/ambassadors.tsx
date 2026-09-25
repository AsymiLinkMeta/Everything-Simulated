import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  staffListAllAmbassadors,
  staffUpsertAmbassador,
  staffDeleteAmbassador,
} from "@/lib/es/ambassadors";
import type { AmbassadorRow, AmbassadorSocial, RigSpec } from "@/lib/es/ambassadors";

export const Route = createFileRoute("/staff/ambassadors")({
  component: StaffAmbassadors,
});

function StaffAmbassadors() {
  const qc = useQueryClient();
  const { data: ambassadors, isPending } = useQuery({
    queryKey: ["staff-ambassadors"],
    queryFn: staffListAllAmbassadors,
  });
  const [editing, setEditing] = useState<AmbassadorRow | "new" | null>(null);

  const del = useMutation({
    mutationFn: (slug: string) => staffDeleteAmbassador(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
      qc.invalidateQueries({ queryKey: ["ambassadors"] });
    },
  });

  if (isPending) {
    return <div className="animate-pulse rounded-2xl bg-raised h-64" />;
  }

  const rows = ambassadors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="es-kicker">Ambassadors</p>
          <h1 className="mt-1 text-2xl font-medium">
            {rows.length} ambassador{rows.length === 1 ? "" : "s"}
          </h1>
        </div>
        <Button onClick={() => setEditing("new")}>Add ambassador</Button>
      </div>

      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.slug} className="es-card flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{a.name}</p>
              <p className="text-sm text-muted truncate">
                {a.code} · {a.published ? "Published" : "Draft"}
                {a.userId ? " · Linked" : " · Not linked"}
                {a.motorsport ? ` · ${a.motorsport}` : ""}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete ${a.name}?`)) del.mutate(a.slug);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <AmbassadorForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AmbassadorForm({ initial, onClose }: { initial: AmbassadorRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !initial;

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? "");
  const [motorsport, setMotorsport] = useState(initial?.motorsport ?? "");
  const [series, setSeries] = useState(initial?.series ?? "");
  const [className, setClassName] = useState(initial?.className ?? "");
  const [teamStatus, setTeamStatus] = useState(initial?.teamStatus ?? "");
  const [base, setBase] = useState(initial?.base ?? "");
  const [ageBand, setAgeBand] = useState(initial?.ageBand ?? "");
  const [crate, setCrate] = useState(initial?.crate ?? "");
  const [rigNote, setRigNote] = useState(initial?.rigNote ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [userId, setUserId] = useState(initial?.userId ?? "");
  const [instagram, setInstagram] = useState(initial?.social?.instagram ?? "");
  const [tiktok, setTiktok] = useState(initial?.social?.tiktok ?? "");
  const [youtube, setYoutube] = useState(initial?.social?.youtube ?? "");
  const [facebook, setFacebook] = useState(initial?.social?.facebook ?? "");
  const [rigSpecs, setRigSpecs] = useState<RigSpec[]>(initial?.rigSpecs ?? []);

  const upsert = useMutation({
    mutationFn: () => {
      const social: AmbassadorSocial = {};
      if (instagram.trim()) social.instagram = instagram.trim();
      if (tiktok.trim()) social.tiktok = tiktok.trim();
      if (youtube.trim()) social.youtube = youtube.trim();
      if (facebook.trim()) social.facebook = facebook.trim();
      return staffUpsertAmbassador({
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        bio: bio.trim(),
        photo: photo.trim() || undefined,
        motorsport: motorsport.trim() || undefined,
        series: series.trim() || undefined,
        className: className.trim() || undefined,
        teamStatus: teamStatus.trim() || undefined,
        base: base.trim() || undefined,
        ageBand: ageBand.trim() || undefined,
        crate: crate.trim() || undefined,
        rigNote: rigNote.trim() || undefined,
        rigSpecs: rigSpecs.filter((r) => r.label.trim() && r.value.trim()),
        social: Object.keys(social).length ? social : undefined,
        published,
        sortOrder,
        userId: userId.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
      qc.invalidateQueries({ queryKey: ["ambassadors"] });
      onClose();
    },
  });

  return (
    <div className="es-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{isNew ? "New ambassador" : `Edit ${initial.name}`}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          upsert.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-muted">Name *</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Slug</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from name"
              disabled={!isNew}
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Code *</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. COSGROVE" />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Photo URL</span>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-muted">Bio</span>
          <textarea
            className="mt-1 block w-full rounded-lg border border-white/10 bg-raised px-3 py-2 text-sm"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm text-muted">Motorsport</span>
            <Input value={motorsport} onChange={(e) => setMotorsport(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Series</span>
            <Input value={series} onChange={(e) => setSeries(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Class</span>
            <Input value={className} onChange={(e) => setClassName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Team / status</span>
            <Input value={teamStatus} onChange={(e) => setTeamStatus(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Base</span>
            <Input value={base} onChange={(e) => setBase(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Age band</span>
            <select
              className="mt-1 block w-full rounded-lg border border-white/10 bg-raised px-3 py-2 text-sm"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
            >
              <option value="">Not set</option>
              <option value="U12">U12</option>
              <option value="12-15">12-15</option>
              <option value="16-17">16-17</option>
              <option value="18+">18+</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-muted">Crate (prebuild slug)</span>
            <Input value={crate} onChange={(e) => setCrate(e.target.value)} placeholder="e.g. haptic" />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Rig note</span>
            <Input value={rigNote} onChange={(e) => setRigNote(e.target.value)} />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm text-muted">Rig specs</legend>
          {rigSpecs.map((spec, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Input
                className="flex-1"
                value={spec.label}
                placeholder="Label"
                onChange={(e) => {
                  const next = [...rigSpecs];
                  next[i] = { ...spec, label: e.target.value };
                  setRigSpecs(next);
                }}
              />
              <Input
                className="flex-[2]"
                value={spec.value}
                placeholder="Value"
                onChange={(e) => {
                  const next = [...rigSpecs];
                  next[i] = { ...spec, value: e.target.value };
                  setRigSpecs(next);
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setRigSpecs(rigSpecs.filter((_, j) => j !== i))}>
                X
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setRigSpecs([...rigSpecs, { label: "", value: "" }])}>
            Add spec
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-muted">Instagram URL</span>
            <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">TikTok URL</span>
            <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">YouTube URL</span>
            <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Facebook URL</span>
            <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm text-muted">Sort order</span>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Link to user ID</span>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="paste user uuid" />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span className="text-sm">Published</span>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending ? "Saving..." : isNew ? "Create" : "Save"}
          </Button>
          {upsert.isError && <span className="text-sm text-red-400">{(upsert.error as Error).message}</span>}
        </div>
      </form>
    </div>
  );
}
