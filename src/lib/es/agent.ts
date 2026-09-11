import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";
import { checkCart } from "./checkCart";
import { getCachedProducts } from "./product-cache";
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

export type AgentTurn = {
  reply: string;
  result: CheckResult;
  proposedLines: CartLine[];
  proposedCheck: CheckResult | null;
  followUps: string[];
  messageId?: string;
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

async function callAskBuilder(body: unknown): Promise<{ reply: string; proposedLines: CartLine[]; followUps: string[] }> {
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
    error?: string;
  };
  if (!response.ok) throw new Error(json.error || "AI request failed");
  return {
    reply: json.reply ?? "",
    proposedLines: Array.isArray(json.proposedLines) ? json.proposedLines : [],
    followUps: Array.isArray(json.followUps) ? json.followUps : [],
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

export async function runBuildAgent(input: {
  message: string;
  lines: CartLine[];
  driverWeightKg?: number;
  task?: string;
  extra?: string;
}): Promise<AgentTurn> {
  const user = await currentUser();
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

  let out: { reply: string; proposedLines: CartLine[]; followUps: string[] };
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
    };
  }

  let proposedLines = cleanLines(out.proposedLines);
  let proposedCheck = proposedLines.length ? checkCart({ lines: proposedLines, driverWeightKg: input.driverWeightKg }) : null;
  let reply = out.reply || "Done.";
  let followUps = out.followUps;

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
        const retryCheck = checkCart({ lines: retryLines, driverWeightKg: input.driverWeightKg });
        if (retryCheck.ok || blockCount(retryCheck) < blockCount(proposedCheck)) {
          proposedLines = retryLines;
          proposedCheck = retryCheck;
          reply = retry.reply || reply;
          followUps = retry.followUps.length ? retry.followUps : followUps;
        }
      }
    } catch {
      /* keep first proposal */
    }
  }

  const { data: saved } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "assistant", content: reply })
    .select("id")
    .maybeSingle();

  return {
    reply,
    result,
    proposedLines,
    proposedCheck,
    followUps,
    messageId: saved?.id ? String(saved.id) : undefined,
  };
}

export async function draftStaffReply(input: { subject: string; thread: string; extra?: string }) {
  await currentUser();
  const [playbooks, memory] = await Promise.all([listPlaybooks(), listMemory(12)]);
  const out = await callAskBuilder({
    message: `Draft a short staff reply for this customer thread. Stay in the app. No invented ETAs.`,
    task: "staff_reply",
    playbooks: playbooks.filter((p) => p.active).map((p) => ({ title: p.title, body: p.body })),
    memory: memory.map((m) => ({ title: m.title, body: m.body })),
    extra: `Subject: ${input.subject}\n\nThread:\n${input.thread}\n${input.extra ?? ""}`,
  });
  return out.reply;
}

export async function runStaffCopilot(message: string, extra?: string) {
  await currentUser();
  const [playbooks, memory] = await Promise.all([listPlaybooks(), listMemory(20)]);
  return callAskBuilder({
    message,
    task: "staff_copilot",
    catalog: catalogSnapshot(),
    packages: packageSnapshot(),
    playbooks: playbooks.filter((p) => p.active).map((p) => ({ title: p.title, body: p.body })),
    memory: memory.map((m) => ({ title: m.title, body: m.body })),
    extra,
  });
}
