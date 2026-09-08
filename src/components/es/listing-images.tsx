import { ImagePlus, Star, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_LISTING_IMAGES, sanitizeListingImages, uniqueImages } from "@/lib/es/listing-images";

export async function compressListingImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG or WebP)");
  if (file.size > 12 * 1024 * 1024) throw new Error("Photo must be under 12 MB");
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that photo");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const keepAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  if (keepAlpha) {
    let data = canvas.toDataURL("image/webp", 0.84);
    if (data.startsWith("data:image/webp") && data.length <= 520_000) return data;
    data = canvas.toDataURL("image/png");
    if (data.length <= 520_000) return data;
  }
  let q = 0.82;
  let data = canvas.toDataURL("image/jpeg", q);
  while (data.length > 420_000 && q > 0.48) {
    q -= 0.1;
    data = canvas.toDataURL("image/jpeg", q);
  }
  if (data.length > 520_000) throw new Error("Photo is still too large after compression");
  return data;
}

export function ListingImages({
  images,
  onChange,
  disabled,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const shots = sanitizeListingImages(images);
  const full = shots.length >= MAX_LISTING_IMAGES;

  function setShots(next: string[]) {
    onChange(sanitizeListingImages(next).slice(0, MAX_LISTING_IMAGES));
  }

  async function addFiles(files: FileList | File[]) {
    if (disabled) return;
    const room = MAX_LISTING_IMAGES - shots.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_LISTING_IMAGES} photos`);
      return;
    }
    const list = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room);
    if (!list.length) {
      toast.error("Drop JPEG, PNG or WebP photos");
      return;
    }
    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of list) {
        added.push(await compressListingImage(file));
      }
      setShots(uniqueImages([...shots, ...added]));
      toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addUrl() {
    const next = url.trim();
    if (!next) return;
    if (full) {
      toast.error(`Maximum ${MAX_LISTING_IMAGES} photos`);
      return;
    }
    const cleaned = sanitizeListingImages([...shots, next]);
    if (cleaned.length === shots.length) {
      toast.error("Use an https image URL or upload a photo");
      return;
    }
    setShots(cleaned);
    setUrl("");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div className="es-gallery">
        {shots.map((src, i) => (
          <div key={`${src.slice(0, 48)}-${i}`} className={`es-gallery-item${i === 0 ? " is-primary" : ""}`}>
            <img src={src} alt="" />
            {i === 0 ? <span className="es-gallery-badge">Primary</span> : null}
            <button
              type="button"
              className="es-gallery-remove"
              aria-label="Remove photo"
              disabled={disabled}
              onClick={() => setShots(shots.filter((_, idx) => idx !== i))}
            >
              <X className="size-3.5" />
            </button>
            {i !== 0 ? (
              <button
                type="button"
                className="es-gallery-star"
                aria-label="Set as shop photo"
                disabled={disabled}
                onClick={() => setShots([src, ...shots.filter((_, idx) => idx !== i)])}
              >
                <Star className="size-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {full ? null : (
          <label
            className={`es-dropzone${over ? " is-over" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
            }}
            onDrop={onDrop}
          >
            <ImagePlus className="size-4" />
            <span>{busy ? "Compressing…" : over ? "Drop photos" : "Drop photos here"}</span>
            <span className="text-xs">or click to browse · original photo, no restyle</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              disabled={disabled || busy}
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
              }}
            />
          </label>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… image URL"
          aria-label="Image URL"
          disabled={disabled || full}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || full || !url.trim()} onClick={addUrl}>
          Add URL
        </Button>
      </div>
      <p className="text-xs text-muted">
        {shots.length}/{MAX_LISTING_IMAGES} photos. First tile is the shop image. Manufacturer shots stay as-is — no
        black background, no ES logo.
      </p>
    </div>
  );
}
