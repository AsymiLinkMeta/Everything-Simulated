const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type CartLine = { sku: string; qty: number };

type AgentAction = { type: string; title?: string; body: string };

type RequestBody = {
  systemPrompt?: string;
  userContent?: string;
  message?: string;
  task?: string;
  checker?: unknown;
  cart?: CartLine[];
  catalog?: {
    sku: string;
    brand?: string;
    name?: string;
    category?: string;
    maxNm?: number;
    payloadKg?: number;
    weightKg?: number;
    mounts?: string[];
    qr?: string;
  }[];
  packages?: { slug: string; name: string }[];
  memory?: { title: string; body: string }[];
  playbooks?: { title: string; body: string }[];
  history?: { role: string; content: string }[];
  extra?: string;
};

type AgentOut = {
  reply: string;
  proposedLines: CartLine[];
  followUps: string[];
  actions: AgentAction[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseAgent(raw: string): AgentOut {
  const trimmed = raw.trim();
  try {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    const obj = JSON.parse(start >= 0 ? trimmed.slice(start, end + 1) : trimmed) as Partial<AgentOut> & {
      reply?: string;
      message?: string;
      lines?: CartLine[];
    };
    const reply = String(obj.reply || obj.message || trimmed).slice(0, 5000);
    const lines = Array.isArray(obj.proposedLines)
      ? obj.proposedLines
      : Array.isArray(obj.lines)
        ? obj.lines
        : [];
    const proposedLines = lines
      .filter((l) => l && typeof l.sku === "string" && Number(l.qty) > 0)
      .map((l) => ({ sku: String(l.sku), qty: Math.max(1, Math.round(Number(l.qty) || 1)) }))
      .slice(0, 24);
    const followUps = Array.isArray(obj.followUps)
      ? obj.followUps.map((s) => String(s).slice(0, 120)).filter(Boolean).slice(0, 4)
      : [];
    const actions = Array.isArray(obj.actions)
      ? obj.actions
          .filter((a) => a && typeof a.body === "string" && a.body.trim())
          .map((a) => ({
            type: String(a.type || "note").slice(0, 40),
            title: a.title ? String(a.title).slice(0, 120) : undefined,
            body: String(a.body).slice(0, 2500),
          }))
          .slice(0, 4)
      : [];
    return { reply, proposedLines, followUps, actions };
  } catch {
    return { reply: trimmed.slice(0, 5000), proposedLines: [], followUps: [], actions: [] };
  }
}

function isStaffTask(task?: string) {
  return Boolean(task && (task.startsWith("staff_") || task === "staff_copilot"));
}

function buildSystem(input: RequestBody) {
  if (input.systemPrompt) {
    return `${input.systemPrompt}

Respond as JSON only: {"reply":"markdown-free workshop answer","proposedLines":[{"sku":"tr120s","qty":1}],"followUps":["short follow-up"],"actions":[{"type":"note","body":"..."}]}.
proposedLines is optional. Only use real catalogue SKUs. Never override a checker block.`;
  }
  const packs = (input.packages ?? []).map((p) => p.slug).join(", ") || "starter, haptic, motion";
  const skus = (input.catalog ?? [])
    .slice(0, 90)
    .map((p) => {
      const extra = [
        p.category,
        p.maxNm ? `${p.maxNm}Nm` : "",
        p.payloadKg ? `${p.payloadKg}kg payload` : "",
        p.weightKg ? `${p.weightKg}kg` : "",
        p.mounts?.length ? `mounts:${p.mounts.join("/")}` : "",
        p.qr ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      return `${p.sku} (${extra})`;
    })
    .join(", ");
  const books = (input.playbooks ?? []).map((p) => `- ${p.title}: ${p.body}`).join("\n") || "- Checker is law.";
  const mem = (input.memory ?? []).map((p) => `- ${p.title}: ${p.body}`).join("\n") || "- None yet.";
  const staff = isStaffTask(input.task)
    ? `You are talking to Everything Simulated staff, not the customer. Be terse and SKU-precise.
Staff tools: spec a crate, write a quote, fix a blocked crate, draft a reply, customer brief, job brief.
proposedLines when you are actually changing a crate. actions staff can apply without you writing to the database:
[{"type":"note","body":"CRM note"},{"type":"job_notes","body":"workshop notes"}]
Never invent prices, stock, ETAs or SKUs. Tickets stay in the app. No Xero.`
    : `You spec Gold Coast assembled racing simulators. Tickets stay in the app. No Xero. No invented SKUs, prices, stock or lead times.`;
  return `You are the Everything Simulated workshop agent on the Gold Coast. Phone 0404 619 056.
${staff}

Packages: ${packs}
Catalogue SKUs: ${skus}

Standing playbooks:
${books}

Learned from won builds, staff corrections and thumbs:
${mem}

Compatibility is decided by the checker JSON — never override a block. If blocked, explain the exact issue and suggest only catalogue SKUs that fix it. Prices AUD ex GST.

Current task: ${input.task ?? "chat"}.

Return JSON only:
{"reply":"...","proposedLines":[{"sku":"...","qty":1}],"followUps":["..."],"actions":[{"type":"note","body":"..."}]}
proposedLines only when you are actually changing the crate. followUps are short next questions. actions only for staff tasks.`;
}

function buildUser(input: RequestBody) {
  if (input.userContent) return input.userContent;
  const history = (input.history ?? [])
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  return [
    input.checker ? `Checker JSON: ${JSON.stringify(input.checker)}` : "",
    input.cart ? `Cart: ${JSON.stringify(input.cart)}` : "",
    history ? `Recent thread:\n${history}` : "",
    input.extra ? `Context:\n${input.extra}` : "",
    `Question: ${input.message ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);

    const apiKey = Deno.env.get("XAI_API_KEY");
    const input = (await req.json()) as RequestBody;
    const systemPrompt = buildSystem(input);
    const userContent = buildUser(input);
    if (!userContent.trim()) return json({ error: "Missing prompt content" }, 400);

    if (!apiKey) {
      return json({
        reply: isStaffTask(input.task)
          ? "AI is not configured. Use the checker and catalogue, then save a quote or log a CRM note."
          : "AI is not configured. The checker still applies — fix any blocks, then save a quote or ask the workshop.",
        proposedLines: [],
        followUps: isStaffTask(input.task) ? ["Save a quote", "Log a CRM note"] : ["Save a quote", "Ask the workshop"],
        actions: [],
      });
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: isStaffTask(input.task) ? 1400 : 900,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) return json({ error: "AI request failed" }, 502);
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const reply = body.choices[0]?.message.content;
    if (!reply) return json({ error: "Empty AI response" }, 502);
    return json(parseAgent(reply));
  } catch {
    return json({ error: "Could not reach AI service" }, 500);
  }
});
