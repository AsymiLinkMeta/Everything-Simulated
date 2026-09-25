import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchMyAmbassadorProfile,
  ambassadorSelfUpdate,
  ambassadorLink,
  ambassadorProfilePath,
} from "@/lib/es/ambassadors";
import type { AmbassadorSocial, RigSpec } from "@/lib/es/ambassadors";

export const Route = createFileRoute("/app/ambassador")({
  component: AmbassadorSelfEdit,
});

function AmbassadorSelfEdit() {
  const qc = useQueryClient();
  const { data: profile, isPending } = useQuery({
    queryKey: ["my-ambassador"],
    queryFn: fetchMyAmbassadorProfile,
  });

  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState("");
  const [motorsport, setMotorsport] = useState("");
  const [series, setSeries] = useState("");
  const [className, setClassName] = useState("");
  const [teamStatus, setTeamStatus] = useState("");
  const [base, setBase] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [rigNote, setRigNote] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");
  const [rigSpecs, setRigSpecs] = useState<RigSpec[]>([]);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? "");
    setPhoto(profile.photo ?? "");
    setMotorsport(profile.motorsport ?? "");
    setSeries(profile.series ?? "");
    setClassName(profile.className ?? "");
    setTeamStatus(profile.teamStatus ?? "");
    setBase(profile.base ?? "");
    setAgeBand(profile.ageBand ?? "");
    setRigNote(profile.rigNote ?? "");
    setInstagram(profile.social?.instagram ?? "");
    setTiktok(profile.social?.tiktok ?? "");
    setYoutube(profile.social?.youtube ?? "");
    setFacebook(profile.social?.facebook ?? "");
    setRigSpecs(profile.rigSpecs ?? []);
  }, [profile?.slug]);

  const save = useMutation({
    mutationFn: () => {
      const social: AmbassadorSocial = {};
      if (instagram.trim()) social.instagram = instagram.trim();
      if (tiktok.trim()) social.tiktok = tiktok.trim();
      if (youtube.trim()) social.youtube = youtube.trim();
      if (facebook.trim()) social.facebook = facebook.trim();
      return ambassadorSelfUpdate({
        bio: bio.trim() || undefined,
        photo: photo.trim() || undefined,
        motorsport: motorsport.trim() || undefined,
        series: series.trim() || undefined,
        className: className.trim() || undefined,
        teamStatus: teamStatus.trim() || undefined,
        base: base.trim() || undefined,
        ageBand: ageBand.trim() || undefined,
        rigNote: rigNote.trim() || undefined,
        social: Object.keys(social).length ? social : undefined,
        rigSpecs: rigSpecs.filter((r) => r.label.trim() && r.value.trim()),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ambassador"] });
      qc.invalidateQueries({ queryKey: ["ambassadors"] });
    },
  });

  if (isPending) {
    return <div className="animate-pulse rounded-2xl bg-raised h-64" />;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="es-kicker">Ambassador</p>
        <h1 className="text-2xl font-medium">No ambassador profile linked</h1>
        <p className="text-sm text-muted">
          Your account is not linked to an ambassador profile. A staff member needs to create your profile and connect it to your account first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Ambassador</p>
        <h1 className="mt-1 text-2xl font-medium">{profile.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Code: <strong>{profile.code}</strong>
          {profile.published ? " · Published" : " · Draft (not public yet)"}
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <a href={ambassadorProfilePath(profile.slug)} className="text-accent hover:underline">
            View public profile
          </a>
          <a href={ambassadorLink(profile.code)} className="text-accent hover:underline">
            Checkout link
          </a>
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset className="space-y-4">
          <legend className="text-lg font-medium">About you</legend>
          <label className="block">
            <span className="text-sm text-muted">Bio</span>
            <textarea
              className="mt-1 block w-full rounded-lg border border-white/10 bg-raised px-3 py-2 text-sm"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Photo URL</span>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="/rigs/your-photo.jpg" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-muted">Motorsport</span>
              <Input value={motorsport} onChange={(e) => setMotorsport(e.target.value)} placeholder="e.g. Karting" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Series</span>
              <Input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. AKC" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Class</span>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. KA3 Junior" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Team / status</span>
              <Input value={teamStatus} onChange={(e) => setTeamStatus(e.target.value)} placeholder="e.g. Privateer" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Base</span>
              <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="e.g. Gold Coast" />
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
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium">Socials</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-muted">Instagram URL</span>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
            </label>
            <label className="block">
              <span className="text-sm text-muted">TikTok URL</span>
              <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@..." />
            </label>
            <label className="block">
              <span className="text-sm text-muted">YouTube URL</span>
              <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/..." />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Facebook URL</span>
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium">Rig</legend>
          <label className="block">
            <span className="text-sm text-muted">Rig note</span>
            <textarea
              className="mt-1 block w-full rounded-lg border border-white/10 bg-raised px-3 py-2 text-sm"
              rows={2}
              value={rigNote}
              onChange={(e) => setRigNote(e.target.value)}
            />
          </label>
          {rigSpecs.map((spec, i) => (
            <div key={i} className="flex gap-2 items-end">
              <label className="flex-1">
                <span className="text-sm text-muted">Label</span>
                <Input
                  value={spec.label}
                  onChange={(e) => {
                    const next = [...rigSpecs];
                    next[i] = { ...spec, label: e.target.value };
                    setRigSpecs(next);
                  }}
                />
              </label>
              <label className="flex-[2]">
                <span className="text-sm text-muted">Value</span>
                <Input
                  value={spec.value}
                  onChange={(e) => {
                    const next = [...rigSpecs];
                    next[i] = { ...spec, value: e.target.value };
                    setRigSpecs(next);
                  }}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRigSpecs(rigSpecs.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRigSpecs([...rigSpecs, { label: "", value: "" }])}
          >
            Add spec row
          </Button>
        </fieldset>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save profile"}
          </Button>
          {save.isSuccess && <span className="text-sm text-green-400">Saved</span>}
          {save.isError && <span className="text-sm text-red-400">{(save.error as Error).message}</span>}
        </div>
      </form>
    </div>
  );
}
