import { supabase } from "@/lib/db";
import { RULES } from "./catalog";
import { setLiveRules } from "./product-cache";
import type { CompatibilityRule, Severity } from "./types";

export async function fetchRules(): Promise<CompatibilityRule[]> {
  const { data, error } = await supabase
    .from("compatibility_rules")
    .select("id, left_sku, right_sku, severity, reason, adapter_sku")
    .order("id");
  if (error || !data?.length) {
    setLiveRules(RULES);
    return RULES;
  }
  const rules = data.map((row) => ({
    id: String(row.id),
    left: String(row.left_sku),
    right: String(row.right_sku),
    severity: (row.severity as Severity) || "warn",
    reason: String(row.reason ?? ""),
    adapterSku: row.adapter_sku ? String(row.adapter_sku) : undefined,
  }));
  setLiveRules(rules);
  return rules;
}

export async function staffSaveRule(rule: CompatibilityRule) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const id = rule.id.trim() || `${rule.left}-${rule.right}`.slice(0, 48);
  const { error } = await supabase.from("compatibility_rules").upsert({
    id,
    left_sku: rule.left.trim(),
    right_sku: rule.right.trim(),
    severity: rule.severity,
    reason: rule.reason.trim(),
    adapter_sku: rule.adapterSku?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return { id };
}

export async function staffDeleteRule(id: string) {
  const { error } = await supabase.from("compatibility_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
