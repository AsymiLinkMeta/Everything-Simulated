import { supabase } from "@/lib/db";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  link_url: string | null;
  sort_order: number;
  created_at: string;
};

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Brand[];
}

async function requireStaff() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || !["sales", "workshop", "content", "support", "admin"].includes(profile.role)) {
    throw new Error("Staff access required");
  }
  return user.id;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function staffCreateBrand(input: {
  name: string;
  iconUrl?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
}): Promise<Brand> {
  await requireStaff();
  const name = input.name.trim();
  if (!name) throw new Error("Brand name is required");
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("brands")
    .insert({
      name,
      slug,
      icon_url: input.iconUrl?.trim() || null,
      link_url: input.linkUrl?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Brand;
}

export async function staffUpdateBrand(
  id: string,
  patch: Partial<Pick<Brand, "name" | "icon_url" | "link_url" | "sort_order">>,
): Promise<void> {
  await requireStaff();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.icon_url !== undefined) update.icon_url = patch.icon_url?.trim() || null;
  if (patch.link_url !== undefined) update.link_url = patch.link_url?.trim() || null;
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  const { error } = await supabase.from("brands").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function staffDeleteBrand(id: string): Promise<void> {
  await requireStaff();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
