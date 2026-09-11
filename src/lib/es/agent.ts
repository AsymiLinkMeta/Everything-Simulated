import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";
import { checkCart } from "./checkCart";
import { getCachedProducts, getCachedProductMap, fetchProducts } from "./product-cache";
import { livePackages } from "./prebuilds";
import type { CartLine, CheckResult } from "./types";

export type AgentPlaybook = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  sort_order: number;
};

export type AgentMemory = {
  id: string;
  kind: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  source: string;
  score: number;
  created_at: string;
};

export type AgentAction = {
  type: string;
  title?: string;
  body: string;
};

export type AgentTurn = {
  reply: string;
  result: CheckResult;
  proposedLines: CartLine[];
  proposedCheck: CheckResult | null;
  followUps: string[];
  actions: AgentAction[];
  messageId?: string;
};

export const STAFF_TOOLS = [
  { id: "spec", task: "staff_spec", label: "Spec a crate", hint: "BOM from a brief. Checker has the last word." },
  { id: "quote", task: "staff_quote", label: "Write a quote", hint: "Sales quote and talking points." },
  { id: "fix", task: "staff_fix", label: "Fix a crate", hint: "Unblock a checker hold with real SKUs." },
  { id: "reply", task: "staff_reply", label: "Draft a reply", hint: "Stays in the app. No invented ETAs." },
  { id: "crm", task: "staff_crm", label: "Customer brief", hint: "Next action and talking points." },
  { id: "job", task: "staff_job", label: "Job brief", hint: "Workshop notes for the build." },
] as const;

export type StaffToolId = (typeof STAFF_TOOLS)[number]["id"];

export type AgentRun = {
  id: string;
  tool: string;
  prompt: string;
  reply: string;
  proposed_lines: CartLine[];
  check_ok: boolean | null;
  contact_id: string | null;
  quote_id: string | null;
  job_id: number | null;
  created_at: string;
};

export type StaffTurn = AgentTurn & {
  tool: StaffToolId;
};

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user;
}

export async function listPlaybooks(): Promise<AgentPlaybook[]> {
  const { data, error } = await supabase
    .from("agent_playbooks")
    .select("id, title, body, active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as AgentPlaybook[];
}

export async function savePlaybook(input: { id?: string; title: string; body: string; active?: boolean }) {
  const user = await currentUser();
  const row = {
    title: input.title.trim(),
    body: input.body.trim(),
    active: input.active ?? true,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (!row.title || !row.body) throw new Error("Title and instruction required");
  if (input.id) {
    const { error } = await supabase.from("agent_playbooks").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await supabase.from("agent_playbooks").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return { id: data?.id as string };
}

export async function deletePlaybook(id: string) {
  const { error } = await supabase.from("agent_playbooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMemory(limit = 40): Promise<AgentMemory[]> {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("id, kind, title, body, payload, source, score, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AgentMemory[];
}

export async function recordMemory(input: {
  kind: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  source?: string;
}) {
  const { error } = await supabase.rpc("record_agent_memory", {
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body,
    p_payload: input.payload ?? {},
    p_source: input.source ?? "staff",
  });
  if (error) throw new Error(error.message);
}

export async function scoreMemory(id: string, delta: 1 | -1) {
  const { error } = await supabase.rpc("score_agent_memory", { p_id: id, p_delta: delta });
  if (error) throw new Error(error.message);
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("agent_memory").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function rateAgent(input: { targetKind: string; targetId?: string; rating: 1 | -1; note?: string }) {
  const user = await currentUser();
  const { error } = await supabase.from("agent_feedback").insert({
    user_id: user.id,
    target_kind: input.targetKind,
    target_id: input.targetId ?? null,
    rating: input.rating,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  if (input.rating > 0 && input.note) {
    await recordMemory({
      kind: "correction",
      title: "Staff-approved reply",
      body: input.note.slice(0, 1200),
      source: "staff",
    }).catch(() => {});
  }
}

export async function listAgentRuns(limit = 20): Promise<AgentRun[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, tool, prompt, reply, proposed_lines, check_ok, contact_id, quote_id, job_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => ({
    ...(row as AgentRun),
    proposed_lines: Array.isArray(row.proposed_lines) ? (row.proposed_lines as CartLine[]) : [],
  }));
}

async function saveAgentRun(input: {
  tool: string;
  prompt: string;
  reply: string;
  proposedLines: CartLine[];
  checkOk: boolean | null;
  contactId?: string;
  quoteId?: string;
  jobId?: number;
}) {
  const user = await currentUser();
  await supabase.from("agent_runs").insert({
    user_id: user.id,
    tool: input.tool,
    prompt: input.prompt.slice(0, 2000),
    reply: input.reply.slice(0, 5000),
    proposed_lines: input.proposedLines,
    check_ok: input.checkOk,
    contact_id: input.contactId ?? null,
    quote_id: input.quoteId ?? null,
    job_id: input.jobId ?? null,
  });
}

type AskOut = { reply: string; proposedLines: CartLine[]; followUps: string[]; actions: AgentAction[] };

async function callAskBuilder(body: unknown): Promise<AskOut> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in required");
  const response = await fetch(`${supabaseUrl}/functions/v1/ask-builder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    reply?: string;
    proposedLines?: CartLine[];
    followUps?: string[];
    actions?: AgentAction[];
    error?: string;
  };
  if (!response.ok) throw new Error(json.error || "AI request failed");
  return {
    reply: json.reply ?? "",
    proposedLines: Array.isArray(json.proposedLines) ? json.proposedLines : [],
    followUps: Array.isArray(json.followUps) ? json.followUps : [],
    actions: Array.isArray(json.actions) ? json.actions : [],
  };
}

function knownSkus() {
  return new Set(getCachedProducts().map((p) => p.sku));
}

function catalogSnapshot() {
  return getCachedProducts().map((p) => ({
    sku: p.sku,
    brand: p.brand,
    name: p.name,
    category: p.category,
    maxNm: p.maxNm,
    payloadKg: p.payloadKg,
    weightKg: p.weightKg,
    mounts: p.mounts,
    qr: p.qr,
  }));
}

function packageSnapshot() {
  return livePackages().map((p) => ({ slug: p.slug, name: p.name }));
}

function cleanLines(lines: CartLine[]): CartLine[] {
  const ok = knownSkus();
  return lines.filter((l) => ok.has(l.sku) && l.qty > 0).slice(0, 24);
}

function blockCount(result: CheckResult | null) {
  return result?.issues.filter((i) => i.severity === "block").length ?? 0;
}

function asLines(raw: unknown): CartLine[] {
  if (typeof raw === "string") {
    try {
      return asLines(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ sku: String((l as CartLine).sku ?? ""), qty: Math.max(0, Number((l as CartLine).qty) || 0) }))
    .filter((l) => l.sku && l.qty > 0);
}

export function skuLabel(sku: string) {
  const p = getCachedProductMap()[sku];
  return p ? `${p.brand} ${p.name}` : sku;
}

export async function runBuildAgent(input: {
  message: string;
  lines: CartLine[];
  driverWeightKg?: number;
  task?: string;
  extra?: string;
}): Promise<AgentTurn> {
  const user = await currentUser();
  if (!getCachedProducts().length) await fetchProducts().catch(() => {});
  const result = checkCart({ lines: input.lines, driverWeightKg: input.driverWeightKg });
  const [playbooks, memory, history] = await Promise.all([
    listPlaybooks(),
    listMemory(16),
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(8)
      .then((r) => r.data ?? []),
  ]);
  await supabase.from("chat_messages").insert({
    user_id: user.id,
    role: "user",
    content: input.message.slice(0, 4000),
  });

  const shared = {
    checker: result,
    cart: input.lines,
    catalog: catalogSnapshot(),
    packages: packageSnapshot(),
    memory: memory.filter((m) => m.score > 0).map((m) => ({ title: m.title, body: m.body })),
    playbooks: playbooks.filter((p) => p.active).map((p) => ({ title: p.title, body: p.body })),
    history: [...history].reverse(),
  };

  let out: AskOut;
  try {
    out = await callAskBuilder({
      message: input.message,
      task: input.task ?? "chat",
      extra: input.extra,
      ...shared,
    });
  } catch {
    out = {
      reply: result.ok
        ? "The checker is green. Save a quote or ask the workshop if you want a human on it."
        : `Blocked: ${result.issues.find((i) => i.severity === "block")?.message ?? "conflicting parts"}.`,
      proposedLines: [],
      followUps: ["Save a quote", "Ask the workshop"],
      actions: [],
    };
  }

  const verified = await verifyProposal(out, shared, input.driverWeightKg);
  const { data: saved } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "assistant", content: verified.reply })
    .select("id")
    .maybeSingle();

  return {
    reply: verified.reply,
    result,
    proposedLines: verified.proposedLines,
    proposedCheck: verified.proposedCheck,
    followUps: verified.followUps,
    actions: verified.actions,
    messageId: saved?.id ? String(saved.id) : undefined,
  };
}

async function verifyProposal(
  out: AskOut,
  shared: Record<string, unknown>,
  driverWeightKg?: number,
): Promise<{
  reply: string;
  proposedLines: CartLine[];
  proposedCheck: CheckResult | null;
  followUps: string[];
  actions: AgentAction[];
}> {
  let proposedLines = cleanLines(out.proposedLines);
  let proposedCheck = proposedLines.length ? checkCart({ lines: proposedLines, driverWeightKg }) : null;
  let reply = out.reply || "Done.";
  let followUps = out.followUps;
  let actions = out.actions;

  if (proposedLines.length && proposedCheck && !proposedCheck.ok && blockCount(proposedCheck) > 0) {
    try {
      const retry = await callAskBuilder({
        message: "The crate you just proposed is blocked. Propose a different crate that the checker will pass. Only real catalogue SKUs.",
        task: "fix",
        extra: `Blocked proposal: ${JSON.stringify(proposedLines)}\nChecker: ${JSON.stringify(proposedCheck.issues)}`,
        ...shared,
        cart: proposedLines,
        checker: proposedCheck,
      });
      const retryLines = cleanLines(retry.proposedLines);
      if (retryLines.length) {
        const retryCheck = checkCart({ lines: retryLines, driverWeightKg });
        if (retryCheck.ok || blockCount(retryCheck) < blockCount(proposedCheck)) {
          proposedLines = retryLines;
          proposedCheck = retryCheck;
          reply = retry.reply || reply;
          followUps = retry.followUps.length ? retry.followUps : followUps;
          actions = retry.actions.length ? retry.actions : actions;
        }
      }
    } catch {
      /* keep first proposal */
    }
  }

  return { reply, proposedLines, proposedCheck, followUps, actions };
}

async function staffContext(input: {
  contactId?: string;
  quoteId?: string;
  jobId?: number;
  ticketId?: string;
  extra?: string;
}) {
  const chunks: string[] = [];
  if (input.contactId) {
    const { data: c } = await supabase.from("crm_contacts").select("*").eq("id", input.contactId).maybeSingle();
    if (c) {
      chunks.push(
        `Customer: ${c.display_name} · ${c.email ?? "no email"} · ${c.phone ?? ""} · ${c.postcode ?? ""} · stage ${c.crm_stage} · tags ${(c.tags ?? []).join(", ")} · notes ${String(c.notes ?? "").slice(0, 400)}`,
      );
      const { data: notes } = await supabase
        .from("crm_notes")
        .select("kind, body, created_at")
        .eq("contact_id", input.contactId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (notes?.length) chunks.push(`Recent CRM notes:\n${notes.map((n) => `${n.kind}: ${n.body}`).join("\n")}`);
      const { data: orders } = await supabase
        .from("shop_orders")
        .select("id, status, total_ex_gst, lines")
        .eq("contact_id", input.contactId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (orders?.length) {
        chunks.push(
          `Orders:\n${orders.map((o) => `${o.id} ${o.status} ${o.total_ex_gst} ${JSON.stringify(asLines(o.lines))}`).join("\n")}`,
        );
      }
    }
  }
  if (input.quoteId) {
    const { data: q } = await supabase
      .from("quotes")
      .select("id, title, status, lines, check_ok, total_ex_gst, postcode")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (q) chunks.push(`Quote ${q.id}: ${q.title} · ${q.status} · ${q.check_ok ? "clear" : "blocked"} · ${JSON.stringify(asLines(q.lines))}`);
  }
  if (input.jobId) {
    const { data: j } = await supabase
      .from("jobs")
      .select("id, stage, notes, quote_id, order_id, user_id")
      .eq("id", input.jobId)
      .maybeSingle();
    if (j) {
      chunks.push(`Job #${j.id} stage ${j.stage} · quote ${j.quote_id ?? "none"} · order ${j.order_id ?? "none"} · notes ${j.notes}`);
      if (j.quote_id && !input.quoteId) {
        const { data: q } = await supabase.from("quotes").select("lines, check_ok, title").eq("id", j.quote_id).maybeSingle();
        if (q) chunks.push(`Job quote ${j.quote_id}: ${q.title} · ${q.check_ok ? "clear" : "blocked"} · ${JSON.stringify(asLines(q.lines))}`);
      }
    }
  }
  if (input.ticketId) {
    const { data: t } = await supabase
      .from("support_tickets")
      .select("id, subject, status, contact_name, contact_email, order_id, body")
      .eq("id", input.ticketId)
      .maybeSingle();
    if (t) {
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("author_role, body")
        .eq("ticket_id", input.ticketId)
        .order("created_at", { ascending: true })
        .limit(12);
      chunks.push(
        `Ticket ${t.subject} (${t.status}) ${t.contact_name} ${t.contact_email}\n${t.body}\n${(msgs ?? []).map((m) => `${m.author_role}: ${m.body}`).join("\n")}`,
      );
    }
  }
  if (input.extra) chunks.push(input.extra);
  return chunks.join("\n\n").slice(0, 8000);
}

export async function runStaffAgent(input: {
  tool: StaffToolId;
  message: string;
  lines?: CartLine[];
  driverWeightKg?: number;
  contactId?: string;
  quoteId?: string;
  jobId?: number;
  ticketId?: string;
  extra?: string;
  history?: { role: string; content: string }[];
}): Promise<StaffTurn> {
  await currentUser();
  if (!getCachedProducts().length) await fetchProducts().catch(() => {});
  const spec = STAFF_TOOLS.find((t) => t.id === input.tool) ?? STAFF_TOOLS[0];
  let lines = input.lines ?? [];
  if (!lines.length && input.quoteId) {
    const { data: q } = await supabase.from("quotes").select("lines").eq("id", input.quoteId).maybeSingle();
    lines = asLines(q?.lines);
  }
  const result = checkCart({ lines, driverWeightKg: input.driverWeightKg });
  const [playbooks, memory, extra] = await Promise.all([
    listPlaybooks(),
    listMemory(20),
    staffContext(input),
  ]);
  const shared = {
    checker: result,
    cart: lines,
    catalog: catalogSnapshot(),
    packages: packageSnapshot(),
    memory: memory
      .filter((m) => m.score > 0)
      .sort((a, b) => (a.kind === "won_bom" ? -1 : 0) - (b.kind === "won_bom" ? -1 : 0))
      .map((m) => ({ title: m.title, body: m.body })),
    playbooks: playbooks.filter((p) => p.active).map((p) => ({ title: p.title, body: p.body })),
    history: input.history ?? [],
  };

  let out: AskOut;
  try {
    out = await callAskBuilder({
      message: input.message,
      task: spec.task,
      extra,
      ...shared,
    });
  } catch {
    out = {
      reply: "Agent unavailable. Use the checker and catalogue, then save a quote or log a note.",
      proposedLines: [],
      followUps: ["Spec a crate", "Log a CRM note"],
      actions: [],
    };
  }

  const verified = await verifyProposal(out, shared, input.driverWeightKg);
  await saveAgentRun({
    tool: input.tool,
    prompt: input.message,
    reply: verified.reply,
    proposedLines: verified.proposedLines,
    checkOk: verified.proposedCheck ? verified.proposedCheck.ok : result.ok,
    contactId: input.contactId,
    quoteId: input.quoteId,
    jobId: input.jobId,
  }).catch(() => {});

  return {
    tool: input.tool,
    reply: verified.reply,
    result,
    proposedLines: verified.proposedLines,
    proposedCheck: verified.proposedCheck,
    followUps: verified.followUps,
    actions: verified.actions,
  };
}

export async function draftStaffReply(input: { subject: string; thread: string; extra?: string }) {
  const turn = await runStaffAgent({
    tool: "reply",
    message: `Draft a short staff reply for this customer thread. Stay in the app. No invented ETAs.`,
    extra: `Subject: ${input.subject}\n\nThread:\n${input.thread}\n${input.extra ?? ""}`,
  });
  return turn.reply;
}

export async function runStaffCopilot(message: string, extra?: string) {
  return runStaffAgent({ tool: "spec", message, extra });
}
