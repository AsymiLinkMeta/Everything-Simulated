import { RULES } from "./catalog";
import { freightExGst } from "./freight";
import { getCachedProductMap, getLiveRules } from "./product-cache";
import type { CartLine, CheckIssue, CheckResult, CompatibilityRule, Product } from "./types";

const UNIQUE = new Set(["chassis", "wheelbase", "motion", "pc", "seat"]);

function pairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function checkCart(input: {
  lines: CartLine[];
  products?: Record<string, Product>;
  rules?: CompatibilityRule[];
  driverWeightKg?: number;
  postcode?: string;
}): CheckResult {
  const products = input.products ?? getCachedProductMap();
  const rules = input.rules ?? getLiveRules() ?? RULES;
  const issues: CheckIssue[] = [];
  const expanded: { sku: string; qty: number; product: Product }[] = [];

  for (const line of input.lines) {
    if (line.qty < 1) continue;
    const product = products[line.sku];
    if (!product) {
      issues.push({
        code: "UNKNOWN_SKU",
        severity: "block",
        message: `${line.sku} is not in the catalogue.`,
      });
      continue;
    }
    expanded.push({ sku: line.sku, qty: line.qty, product });
  }

  const byCat = new Map<string, typeof expanded>();
  for (const row of expanded) {
    const list = byCat.get(row.product.category) ?? [];
    list.push(row);
    byCat.set(row.product.category, list);
  }

  for (const cat of UNIQUE) {
    const list = byCat.get(cat) ?? [];
    const kinds = new Set(list.map((r) => r.sku));
    if (kinds.size > 1) {
      issues.push({
        code: `MULTI_${cat.toUpperCase()}`,
        severity: "block",
        message: `A build can only have one ${cat}. Remove the extra line.`,
        fix: list.map((r) => `Keep ${r.product.name}`),
      });
    }
  }

  const skus = expanded.map((r) => r.sku);
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!skus.includes(rule.left) || !skus.includes(rule.right)) continue;
    const key = pairKey(rule.left, rule.right) + rule.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (rule.severity === "allow") continue;
    issues.push({
      code: rule.id.toUpperCase(),
      severity: rule.severity,
      message: rule.reason,
      adapterSku: rule.adapterSku,
      fix: rule.adapterSku
        ? [`Add adapter ${rule.adapterSku}`]
        : rule.severity === "block"
          ? ["Swap the conflicting part"]
          : undefined,
    });
  }

  const chassis = byCat.get("chassis")?.[0]?.product;
  const motion = byCat.get("motion")?.[0]?.product;
  if (motion?.payloadKg && chassis) {
    const payload =
      (input.driverWeightKg ?? 80) +
      expanded.reduce((sum, r) => sum + (r.product.weightKg ?? 0) * r.qty, 0);
    if (payload > motion.payloadKg) {
      issues.push({
        code: "MOTION_PAYLOAD",
        severity: "block",
        message: `Estimated payload ${Math.round(payload)} kg exceeds ${motion.name} rating of ${motion.payloadKg} kg.`,
        fix: ["Reduce screens", "Choose a lighter seat", "Confirm driver weight"],
      });
    }
  }

  const wheelbase = byCat.get("wheelbase")?.[0]?.product;
  if (chassis?.maxNm && wheelbase?.maxNm && wheelbase.maxNm > chassis.maxNm) {
    issues.push({
      code: "TORQUE_CHASSIS",
      severity: "warn",
      message: `${wheelbase.name} exceeds the ${chassis.name} recommended ${chassis.maxNm}Nm ceiling.`,
      fix: ["Upgrade chassis", "Choose a lower-torque base"],
    });
  }

  const adaptersNeeded = issues.filter((i) => i.severity === "adapter" && i.adapterSku);
  for (const issue of adaptersNeeded) {
    if (issue.adapterSku && !skus.includes(issue.adapterSku)) {
      issues.push({
        code: `MISSING_${issue.adapterSku}`,
        severity: "adapter",
        message: `Required adapter ${issue.adapterSku} is not in the cart.`,
        adapterSku: issue.adapterSku,
        fix: [`Add ${issue.adapterSku}`],
      });
    }
  }

  let totalExGst = 0;
  let lead: [number, number] = [0, 0];
  for (const row of expanded) {
    totalExGst += row.product.sellExGst * row.qty;
    lead = [Math.max(lead[0], row.product.leadWeeks[0]), Math.max(lead[1], row.product.leadWeeks[1])];
  }

  const freight = freightExGst(input.postcode, input.lines);
  const blocks = issues.some((i) => i.severity === "block");
  return {
    ok: !blocks,
    issues,
    totalExGst,
    totalIncGst: Math.round((totalExGst + freight) * 1.1),
    freightExGst: freight,
    leadWeeks: lead,
  };
}

export function linesFromPackage(lines: CartLine[]) {
  return lines.map((l) => ({ ...l }));
}
