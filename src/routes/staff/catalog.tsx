import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Search, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { ListingImages } from "@/components/es/listing-images";
import { fetchProducts, invalidateProductCache } from "@/lib/es/product-cache";
import { sanitizeListingImages, uniqueImages } from "@/lib/es/listing-images";
import {
  staffDeleteCatalogProduct,
  staffListCatalogProducts,
  staffListOverrides,
  staffOverridePrice,
  staffSaveCatalogProduct,
  staffSetListingStatus,
  type CatalogProduct,
} from "@/lib/es/server";
import type { ProductListing } from "@/lib/es/product-listing";
import { generateProductListing } from "@/lib/es/product-listing";
import { discoverProducts, type DiscoveredProduct } from "@/lib/es/discover";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/catalog")({
  component: Catalog,
});

const CATEGORIES = [
  "chassis",
  "wheelbase",
  "wheel",
  "pedals",
  "shifter",
  "handbrake",
  "seat",
  "motion",
  "monitor",
  "mount",
  "pc",
  "audio",
  "headset",
  "software",
  "adapter",
  "accessory",
] as const;

type Draft = {
  brand: string;
  productName: string;
  category: string;
  price: string;
  details: string;
  url: string;
};

const EMPTY_DRAFT: Draft = {
  brand: "",
  productName: "",
  category: "accessory",
  price: "",
  details: "",
  url: "",
};

function Catalog() {
  const qc = useQueryClient();
  const overrides = useQuery({ queryKey: ["overrides"], queryFn: () => staffListOverrides() });
  const customProducts = useQuery({
    queryKey: ["catalog-products"],
    queryFn: () => staffListCatalogProducts(),
  });
  const allProducts = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const map = Object.fromEntries((overrides.data ?? []).map((o) => [o.sku, o.sell_ex_gst]));
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const [showGenerator, setShowGenerator] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ listing: ProductListing; source: "grok" | "draft" } | null>(null);
  const [editListing, setEditListing] = useState<ProductListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [editingWithAi, setEditingWithAi] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");
  const [searchingSku, setSearchingSku] = useState(false);
  const [hits, setHits] = useState<DiscoveredProduct[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  async function savePrice(sku: string) {
    const dollars = Number(priceDraft[sku]);
    if (!Number.isFinite(dollars)) return;
    try {
      await staffOverridePrice({ sku, sellExGst: Math.round(dollars * 100) });
      toast.success(`${sku} updated`);
      await qc.invalidateQueries({ queryKey: ["overrides"] });
    } catch {
      toast.error("Could not save price");
    }
  }

  async function handleAiSkuSearch() {
    const query = skuSearch.trim();
    if (!query) {
      toast.error("Enter a SKU, model number, or product name");
      return;
    }
    setSearchingSku(true);
    try {
      const found = await discoverProducts({ query });
      if (!found.products.length) {
        toast.error("No official manufacturer hit. Paste the product URL instead.");
        return;
      }
      if (found.products.length === 1) {
        setDraft((d) => ({
          ...d,
          brand: found.products[0].brand || d.brand,
          productName: found.products[0].title,
          url: found.products[0].url,
        }));
        await ingestUrl(found.products[0].url, found.products[0]);
        return;
      }
      setHits(found.products);
      setPicked(found.products.slice(0, 8).map((p) => p.key));
      toast.success(`${found.products.length} manufacturer hits`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not search that SKU");
    } finally {
      setSearchingSku(false);
    }
  }

  async function ingestUrl(url: string, hit?: DiscoveredProduct) {
    setGenerating(true);
    try {
      const result = await generateProductListing({
        brand: hit?.brand || draft.brand,
        productName: hit?.title || draft.productName,
        category: draft.category,
        price: draft.price,
        details: draft.details,
        url,
        discovered: hit,
      });
      const photos = uniqueImages([
        ...draftImages,
        hit?.image ?? "",
        ...(result.listing.images ?? []),
        result.listing.imageUrl ?? "",
      ]);
      setGenerated({ listing: result.listing, source: result.source === "grok" ? "grok" : "draft" });
      setEditListing({
        ...result.listing,
        images: photos,
        imageUrl: photos[0] || result.listing.imageUrl,
        listingStatus: "draft",
      });
      setShowGenerator(true);
    } catch {
      toast.error("Could not generate a listing from that page");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDiscoverPage() {
    const url = draft.url.trim();
    if (!url) {
      toast.error("Paste a manufacturer product or collection URL");
      return;
    }
    setSearchingSku(true);
    try {
      const found = await discoverProducts({ url });
      if (!found.products.length) {
        await ingestUrl(url);
        return;
      }
      if (found.kind === "product" || found.products.length === 1) {
        setDraft((d) => ({ ...d, url: found.products[0].url, productName: found.products[0].title, brand: found.products[0].brand || d.brand }));
        await ingestUrl(found.products[0].url, found.products[0]);
        return;
      }
      setHits(found.products);
      setPicked(found.products.slice(0, 8).map((p) => p.key));
      toast.success(`${found.products.length} products on that page`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that page");
    } finally {
      setSearchingSku(false);
    }
  }

  async function handleBatchDrafts() {
    const selected = hits.filter((h) => picked.includes(h.key)).slice(0, 8);
    if (!selected.length) {
      toast.error("Pick at least one product");
      return;
    }
    setBatchBusy(true);
    let saved = 0;
    try {
      for (const hit of selected) {
        const result = await generateProductListing({
          brand: hit.brand || draft.brand,
          productName: hit.title,
          category: draft.category,
          price: draft.price,
          details: draft.details,
          url: hit.url,
          discovered: hit,
        });
        const photos = uniqueImages([hit.image ?? "", ...(result.listing.images ?? []), result.listing.imageUrl ?? ""]);
        await staffSaveCatalogProduct({
          sku: result.listing.sku,
          brand: result.listing.brand,
          name: result.listing.name,
          category: result.listing.category,
          sell_ex_gst: result.listing.price,
          stock_status: result.listing.stockStatus,
          listing_status: "draft",
          lead_weeks_min: result.listing.leadWeeksMin,
          lead_weeks_max: result.listing.leadWeeksMax,
          description: result.listing.description,
          notes: result.listing.notes,
          image_url: photos[0] || null,
          images: photos,
          manufacturer_url: hit.url,
          whats_included: result.listing.whatsIncluded ?? [],
          mount_compatibility: result.listing.mountCompatibility ?? "",
          assembly_manual_url: result.listing.assemblyManualUrl ?? null,
          specs: result.listing.specs ?? {},
          compare: result.listing.compare ?? "",
          max_nm: result.listing.maxNm ?? null,
          payload_kg: result.listing.payloadKg ?? null,
          weight_kg: result.listing.weightKg ?? null,
          mounts: result.listing.mounts ?? [],
          qr: result.listing.qr ?? null,
        });
        saved += 1;
      }
      toast.success(`${saved} draft${saved === 1 ? "" : "s"} saved — not on the shop`);
      setHits([]);
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["catalog-products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch stopped");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleAiEditListing() {
    if (!editListing) return;
    setEditingWithAi(true);
    try {
      const result = await generateProductListing({
        brand: editListing.brand,
        productName: editListing.name,
        category: editListing.category,
        price: String(editListing.price / 100),
        details: `${editListing.description}\n${editListing.notes}`,
        url: editListing.manufacturerUrl,
      });
      setEditListing((listing) =>
        listing
          ? {
              ...listing,
              ...result.listing,
              imageUrl: listing.imageUrl,
              images: listing.images,
            }
          : listing,
      );
      toast.success("Listing copy rewritten — photos left as-is");
    } catch {
      toast.error("Could not edit listing with AI");
    } finally {
      setEditingWithAi(false);
    }
  }

  async function handleGenerate() {
    if (!draft.url.trim() && (!draft.brand.trim() || !draft.productName.trim())) {
      toast.error("Add brand and product name, or paste a manufacturer URL");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateProductListing(draft);
      const photos = uniqueImages([
        ...draftImages,
        ...(result.listing.images ?? []),
        result.listing.imageUrl ?? "",
      ]);
      setGenerated({ listing: result.listing, source: result.source === "grok" ? "grok" : "draft" });
      setEditListing({
        ...result.listing,
        images: photos,
        imageUrl: photos[0] || result.listing.imageUrl,
      });
    } catch {
      toast.error("Could not generate a listing");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveListing(listing_status: "draft" | "published") {
    if (!editListing) return;
    setSaving(true);
    try {
      await staffSaveCatalogProduct({
        sku: editListing.sku,
        brand: editListing.brand,
        name: editListing.name,
        category: editListing.category,
        sell_ex_gst: editListing.price,
        stock_status: editListing.stockStatus,
        listing_status,
        qty_on_hand: editListing.qtyOnHand ?? 0,
        lead_weeks_min: editListing.leadWeeksMin,
        lead_weeks_max: editListing.leadWeeksMax,
        description: editListing.description,
        notes: editListing.notes,
        image_url: editListing.imageUrl || editListing.images?.[0] || null,
        images: editListing.images ?? (editListing.imageUrl ? [editListing.imageUrl] : []),
        manufacturer_url: editListing.manufacturerUrl || null,
        whats_included: editListing.whatsIncluded ?? [],
        mount_compatibility: editListing.mountCompatibility ?? "",
        assembly_manual_url: editListing.assemblyManualUrl ?? null,
        specs: editListing.specs ?? {},
        compare: editListing.compare ?? "",
        max_nm: editListing.maxNm ?? null,
        payload_kg: editListing.payloadKg ?? null,
        weight_kg: editListing.weightKg ?? null,
        mounts: editListing.mounts ?? [],
        qr: editListing.qr ?? null,
      });
      toast.success(listing_status === "published" ? `${editListing.sku} is live on the shop` : `${editListing.sku} saved as draft`);
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["catalog-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      resetGenerator();
    } catch {
      toast.error("Could not save listing");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, sku: string) {
    try {
      await staffDeleteCatalogProduct(id);
      toast.success(`${sku} removed`);
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["catalog-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast.error("Could not delete listing");
    }
  }

  function resetGenerator() {
    setDraft(EMPTY_DRAFT);
    setGenerated(null);
    setEditListing(null);
    setShowGenerator(false);
    setDraftImages([]);
    setHits([]);
    setPicked([]);
  }

  function loadExisting(p: CatalogProduct) {
    setShowGenerator(true);
    setHits([]);
    setEditListing({
      sku: p.sku,
      brand: p.brand,
      name: p.name,
      category: p.category,
      price: p.sell_ex_gst,
      stockStatus: p.stock_status as ProductListing["stockStatus"],
      leadWeeksMin: p.lead_weeks_min,
      leadWeeksMax: p.lead_weeks_max,
      description: p.description,
      notes: p.notes,
      imageUrl: p.image_url ?? p.images[0],
      images: p.images,
      manufacturerUrl: p.manufacturer_url ?? undefined,
      whatsIncluded: p.whats_included ?? [],
      mountCompatibility: p.mount_compatibility ?? "",
      assemblyManualUrl: p.assembly_manual_url ?? undefined,
      specs: p.specs ?? {},
      compare: p.compare ?? "",
      listingStatus: p.listing_status,
      qtyOnHand: p.qty_on_hand,
      maxNm: p.max_nm ?? null,
      payloadKg: p.payload_kg ?? null,
      weightKg: p.weight_kg ?? null,
      mounts: p.mounts ?? [],
      qr: p.qr ?? null,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Sales</p>
        <h1 className="mt-2 text-3xl font-medium">Catalogue & prices</h1>
        <p className="mt-2 text-sm text-muted">
          Generate new product listings, manage saved SKUs, and override prices. All prices AUD ex GST.
        </p>
      </div>

      {/* ---- Product generator ---- */}
      <section className="es-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-esred" />
            <h2 className="text-base font-medium">Product listing generator</h2>
          </div>
          <Button size="sm" variant={showGenerator ? "ghost" : "primary"} onClick={() => setShowGenerator((v) => !v)}>
            {showGenerator ? "Cancel" : "New product"}
          </Button>
        </div>

        {showGenerator && !editListing && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-lg border border-esred/30 bg-esred/5 p-3">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-esred" />
                <div>
                  <p className="text-sm font-medium">AI SKU search</p>
                  <p className="text-xs text-muted">Searches official Simagic, Trak Racer AU and SIMRIG/Exodus catalogues. Does not invent a product.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="e.g. TR120S V2 or P1000-RS"
                  disabled={searchingSku || generating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAiSkuSearch();
                    }
                  }}
                />
                <Button type="button" onClick={handleAiSkuSearch} disabled={searchingSku || generating || !skuSearch.trim()}>
                  <Search className="size-4" />
                  {searchingSku ? "Searching…" : "Search with AI"}
                </Button>
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-muted">Brand</span>
              <Input
                value={draft.brand}
                onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                placeholder="e.g. Simagic"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Product name</span>
              <Input
                value={draft.productName}
                onChange={(e) => setDraft((d) => ({ ...d, productName: e.target.value }))}
                placeholder="e.g. P1000 Pedals"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Category</span>
              <select
                className="es-input"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Price (optional — AI leaves this at 0 for admins to set)</span>
              <Input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="Admin sets price after generate"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted">Manufacturer URL (product or collection — AI reads the page)</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={draft.url}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                  placeholder="https://simagic.com/collections/pedals"
                />
                <Button type="button" variant="outline" onClick={() => void handleDiscoverPage()} disabled={searchingSku || generating || !draft.url.trim()}>
                  {searchingSku ? "Reading…" : "Read page"}
                </Button>
              </div>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted">Extra details for the listing</span>
              <textarea
                className="es-input min-h-20 resize-y"
                value={draft.details}
                onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))}
                placeholder="Load cell, USB-C, included mounts, etc."
              />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <span className="text-xs text-muted">Product photos</span>
              <ListingImages images={draftImages} onChange={setDraftImages} disabled={generating} />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleGenerate} disabled={generating}>
                <Sparkles className="size-4" />
                {generating ? "Generating…" : "Generate listing"}
              </Button>
            </div>
          </div>
        )}

        {hits.length && !editListing ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <p className="text-sm">
              {hits.length} manufacturer products. Tick up to 8 and generate drafts — they stay off the shop until you publish.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {hits.map((h) => (
                <li key={h.key}>
                  <label className="flex min-h-11 items-center gap-3 rounded-md bg-raised px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(h.key)}
                      onChange={() =>
                        setPicked((cur) => (cur.includes(h.key) ? cur.filter((k) => k !== h.key) : [...cur, h.key].slice(0, 8)))
                      }
                    />
                    {h.image ? <img src={h.image} alt="" className="size-10 rounded-md object-cover" /> : null}
                    <span className="min-w-0 flex-1 truncate">
                      {h.title}
                      <span className="block truncate text-xs text-muted">{h.brand} {h.sku ? `· ${h.sku}` : ""}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleBatchDrafts()} disabled={batchBusy || !picked.length}>
                {batchBusy ? "Writing drafts…" : `Generate ${Math.min(picked.length, 8)} drafts`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const first = hits.find((h) => picked.includes(h.key)) ?? hits[0];
                  if (first) void ingestUrl(first.url, first);
                }}
              >
                Edit one
              </Button>
            </div>
          </div>
        ) : null}

        {editListing && (
          <div className="mt-4 space-y-4">
            {generated && (
              <p className="text-xs text-muted">
                {generated.source === "grok"
                  ? "Draft generated by Grok — review every field before saving."
                  : "Draft generated locally (no API key configured) — review and edit before saving."}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted">SKU</span>
                <Input
                  value={editListing.sku}
                  onChange={(e) => setEditListing((l) => ({ ...l!, sku: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Brand</span>
                <Input
                  value={editListing.brand}
                  onChange={(e) => setEditListing((l) => ({ ...l!, brand: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Product name</span>
                <Input
                  value={editListing.name}
                  onChange={(e) => setEditListing((l) => ({ ...l!, name: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Category</span>
                <select
                  className="es-input"
                  value={editListing.category}
                  onChange={(e) => setEditListing((l) => ({ ...l!, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Price (AUD ex GST, cents) — admin only</span>
                <Input
                  type="number"
                  value={editListing.price}
                  onChange={(e) => setEditListing((l) => ({ ...l!, price: Math.max(0, Number(e.target.value)) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Stock status</span>
                <select
                  className="es-input"
                  value={editListing.stockStatus}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, stockStatus: e.target.value as ProductListing["stockStatus"] }))
                  }
                >
                  <option value="stock">In stock</option>
                  <option value="indent">Indent</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Lead time min (weeks)</span>
                <Input
                  type="number"
                  value={editListing.leadWeeksMin}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, leadWeeksMin: Math.max(0, Number(e.target.value)) }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Lead time max (weeks)</span>
                <Input
                  type="number"
                  value={editListing.leadWeeksMax}
                  onChange={(e) =>
                    setEditListing((l) => ({
                      ...l!,
                      leadWeeksMax: Math.max(editListing.leadWeeksMin, Number(e.target.value)),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Customer-facing description</span>
                  <Button size="sm" variant="outline" onClick={handleAiEditListing} disabled={editingWithAi}>
                    <WandSparkles className="size-4" />
                    {editingWithAi ? "Rewriting…" : "Rewrite copy with AI"}
                  </Button>
                </div>
                <textarea
                  className="es-input min-h-20 resize-y"
                  value={editListing.description}
                  onChange={(e) => setEditListing((l) => ({ ...l!, description: e.target.value }))}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Internal notes (staff only)</span>
                <textarea
                  className="es-input min-h-16 resize-y"
                  value={editListing.notes}
                  onChange={(e) => setEditListing((l) => ({ ...l!, notes: e.target.value }))}
                />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <span className="text-xs text-muted">Product photos</span>
                <ListingImages
                  images={sanitizeListingImages(editListing.images, editListing.imageUrl ? [editListing.imageUrl] : [])}
                  onChange={(next) =>
                    setEditListing((l) => ({
                      ...l!,
                      images: next,
                      imageUrl: next[0] || "",
                    }))
                  }
                  disabled={saving}
                />
              </div>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">What's included (one item per line)</span>
                <textarea
                  className="es-input min-h-20 resize-y"
                  value={(editListing.whatsIncluded ?? []).join("\n")}
                  onChange={(e) =>
                    setEditListing((l) => ({
                      ...l!,
                      whatsIncluded: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="1x TR120S V2 chassis\n1x Wheel deck\n1x Seat Slider"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Mount compatibility</span>
                <textarea
                  className="es-input min-h-16 resize-y"
                  value={editListing.mountCompatibility ?? ""}
                  onChange={(e) => setEditListing((l) => ({ ...l!, mountCompatibility: e.target.value }))}
                  placeholder="Compatible with Simagic Alpha, VRS DirectForce Pro, Fanatec DD1…"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Assembly manual URL</span>
                <Input
                  value={editListing.assemblyManualUrl ?? ""}
                  onChange={(e) => setEditListing((l) => ({ ...l!, assemblyManualUrl: e.target.value || undefined }))}
                  placeholder="https://…"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Specs (JSON key-value)</span>
                <textarea
                  className="es-input min-h-16 resize-y font-mono text-xs"
                  value={Object.entries(editListing.specs ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n")}
                  onChange={(e) => {
                    const specs: Record<string, string> = {};
                    for (const line of e.target.value.split("\n")) {
                      const idx = line.indexOf(":");
                      if (idx > 0) specs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                    }
                    setEditListing((l) => ({ ...l!, specs }));
                  }}
                  placeholder="Material: Extruded aluminium\nProfile: 40x120mm\nWeight: 28kg"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Compare (how this product differs from alternatives)</span>
                <textarea
                  className="es-input min-h-16 resize-y"
                  value={editListing.compare ?? ""}
                  onChange={(e) => setEditListing((l) => ({ ...l!, compare: e.target.value }))}
                  placeholder="The TR120S V2 uses thicker aluminium profile walls than the TR80…"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Max Nm (wheelbase / chassis)</span>
                <Input
                  type="number"
                  value={editListing.maxNm ?? ""}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, maxNm: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  placeholder="e.g. 23"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Payload kg (chassis / motion)</span>
                <Input
                  type="number"
                  value={editListing.payloadKg ?? ""}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, payloadKg: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  placeholder="e.g. 225"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Weight kg</span>
                <Input
                  type="number"
                  value={editListing.weightKg ?? ""}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, weightKg: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  placeholder="e.g. 28"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Quick ref (checker hint)</span>
                <Input
                  value={editListing.qr ?? ""}
                  onChange={(e) => setEditListing((l) => ({ ...l!, qr: e.target.value || null }))}
                  placeholder="e.g. SR2 / XR1 only"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Mount SKUs (comma separated — used by the checker)</span>
                <Input
                  value={(editListing.mounts ?? []).join(", ")}
                  onChange={(e) =>
                    setEditListing((l) => ({
                      ...l!,
                      mounts: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="tr120s, xr1, alpha-evo-side-mount"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveListing("draft")} disabled={saving} variant="outline">
                {saving ? "Saving…" : "Save draft"}
              </Button>
              <Button onClick={() => void handleSaveListing("published")} disabled={saving}>
                Publish to shop
              </Button>
              <Button variant="ghost" onClick={resetGenerator}>
                <X className="size-4" />
                Discard
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Saved custom products ---- */}
      <section>
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted" />
          <h2 className="text-lg font-medium">Saved listings</h2>
        </div>
        {customProducts.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !customProducts.data?.length ? (
          <div className="mt-3 es-card p-6 text-center">
            <Boxes className="mx-auto size-5 text-muted" />
            <p className="mt-2 text-sm text-muted">No custom products yet. Use the generator above to create one.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">SKU</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customProducts.data.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-3 font-medium">{p.sku}</td>
                    <td>
                      {p.brand} {p.name}
                    </td>
                    <td className="capitalize">{p.listing_status}</td>
                    <td className="tabular-nums">{aud(p.sell_ex_gst)}</td>
                    <td className="capitalize">{p.stock_status}{p.qty_on_hand ? ` · ${p.qty_on_hand}` : ""}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => loadExisting(p)}>
                          Edit
                        </Button>
                        {p.listing_status !== "published" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await staffSetListingStatus(p.sku, "published");
                                invalidateProductCache();
                                await qc.invalidateQueries({ queryKey: ["catalog-products"] });
                                await qc.invalidateQueries({ queryKey: ["products"] });
                              } catch {
                                toast.error("Could not publish");
                              }
                            }}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await staffSetListingStatus(p.sku, "draft");
                                invalidateProductCache();
                                await qc.invalidateQueries({ queryKey: ["catalog-products"] });
                                await qc.invalidateQueries({ queryKey: ["products"] });
                              } catch {
                                toast.error("Could not unpublish");
                              }
                            }}
                          >
                            Unpublish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(p.id, p.sku)}
                          className="text-muted hover:text-esred"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Static catalogue price overrides ---- */}
      <section>
        <h2 className="text-lg font-medium">Shop prices</h2>
        <p className="mt-1 text-sm text-muted">Writes the live sell price on the catalogue SKU. Compatibility lives under Rules.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">SKU</th>
                <th>Name</th>
                <th>List</th>
                <th>Override</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(allProducts.data ?? []).map((p) => (
                <tr key={p.sku} className="border-t border-line">
                  <td className="py-3 font-medium">{p.sku}</td>
                  <td>
                    {p.brand} {p.name}
                  </td>
                  <td className="tabular-nums">{aud(p.sellExGst)}</td>
                  <td>
                    <Input
                      className="max-w-28"
                      placeholder={map[p.sku] ? String((map[p.sku] ?? 0) / 100) : ""}
                      value={priceDraft[p.sku] ?? ""}
                      onChange={(e) => setPriceDraft((d) => ({ ...d, [p.sku]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => savePrice(p.sku)}>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
