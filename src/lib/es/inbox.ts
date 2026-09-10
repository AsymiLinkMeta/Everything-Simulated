import { supabase } from "@/lib/db";

export type TicketStatus = "open" | "pending" | "waiting" | "resolved" | "closed";

export type SupportTicket = {
  id: string;
  user_id: string | null;
  contact_email: string;
  contact_name: string;
  order_id: string | null;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_role: string;
  body: string;
  created_at: string;
};

export type InboxItem = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  from_email: string | null;
  from_name: string | null;
  user_id: string | null;
  ticket_id: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

const STAFF = ["sales", "workshop", "content", "support", "admin"];

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function listMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportTicket[];
}

export async function listTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportMessage[];
}

async function pushInbox(row: {
  kind: string;
  subject: string;
  body: string;
  from_email?: string | null;
  from_name?: string | null;
  user_id?: string | null;
  ticket_id?: string | null;
  order_id?: string | null;
}) {
  await supabase.from("staff_inbox").insert({
    kind: row.kind,
    subject: row.subject,
    body: row.body,
    from_email: row.from_email ?? null,
    from_name: row.from_name ?? null,
    user_id: row.user_id ?? null,
    ticket_id: row.ticket_id ?? null,
    order_id: row.order_id ?? null,
  });
}

export async function createTicket(input: {
  subject: string;
  body: string;
  orderId?: string;
  email?: string;
  name?: string;
  kind?: string;
}) {
  const user = await currentUser();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3) throw new Error("Subject is required");
  if (body.length < 4) throw new Error("Write a message");
  let email = (input.email || user?.email || "").trim().toLowerCase();
  let name =
    input.name?.trim() ||
    (user?.user_metadata?.display_name as string | undefined) ||
    "";
  if (!email.includes("@") && input.orderId) {
    const { data: order } = await supabase
      .from("shop_orders")
      .select("contact_id")
      .eq("id", input.orderId)
      .maybeSingle();
    if (order?.contact_id) {
      const { data: contact } = await supabase
        .from("crm_contacts")
        .select("email, display_name")
        .eq("id", order.contact_id)
        .maybeSingle();
      email = (contact?.email || email).toLowerCase();
      name = name || contact?.display_name || "";
    }
  }
  if (!email.includes("@")) throw new Error("Email is required");
  name = name || email.split("@")[0];

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user?.id ?? null,
      contact_email: email,
      contact_name: name,
      order_id: input.orderId?.trim() || null,
      subject,
      body,
      status: "open",
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const ticket = data as SupportTicket;
  await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user?.id ?? null,
    author_role: "customer",
    body,
  });
  await pushInbox({
    kind: input.kind ?? "ticket",
    subject,
    body,
    from_email: email,
    from_name: name,
    user_id: user?.id ?? null,
    ticket_id: ticket.id,
    order_id: input.orderId?.trim() || null,
  });
  return ticket;
}

export async function replyToTicket(ticketId: string, body: string) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to reply");
  const text = body.trim();
  if (!text) throw new Error("Write a reply");
  const { data: profile } = await supabase.from("profiles").select("role, display_name, email").eq("user_id", user.id).maybeSingle();
  const staff = Boolean(profile && STAFF.includes(profile.role as string));
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    author_id: user.id,
    author_role: staff ? "staff" : "customer",
    body: text,
  });
  if (error) throw new Error(error.message);
  await supabase
    .from("support_tickets")
    .update({
      status: staff ? "pending" : "open",
      staff_reply: staff ? text : undefined,
      replied_by: staff ? user.id : undefined,
      replied_at: staff ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (!staff) {
    const { data: ticket } = await supabase.from("support_tickets").select("subject, contact_email, contact_name, order_id").eq("id", ticketId).maybeSingle();
    await pushInbox({
      kind: "ticket",
      subject: ticket?.subject ?? "New reply",
      body: text,
      from_email: ticket?.contact_email,
      from_name: ticket?.contact_name,
      user_id: user.id,
      ticket_id: ticketId,
      order_id: ticket?.order_id,
    });
  }
  return { ok: true };
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  const { error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("staff_inbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxItem[];
}

export async function unreadInboxCount(): Promise<number> {
  const { count, error } = await supabase
    .from("staff_inbox")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markInboxRead(id: string) {
  await supabase.from("staff_inbox").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function postNotice(input: {
  kind: "placed" | "paid" | "tracking" | "refund" | "ticket" | "contact";
  orderId?: string;
  email?: string;
  name?: string;
  extra?: Record<string, string>;
}) {
  const copy: Record<string, { subject: string; body: string }> = {
    placed: {
      subject: `Build request ${input.orderId ?? ""}`.trim(),
      body: `New build request ${input.orderId ?? ""} from ${input.email ?? "customer"}.`,
    },
    paid: {
      subject: `Deposit received ${input.orderId ?? ""}`.trim(),
      body: `Deposit recorded on ${input.orderId ?? ""}.`,
    },
    tracking: {
      subject: `Crate moving ${input.orderId ?? ""}`.trim(),
      body: `Tracking ${input.extra?.tracking ?? "issued"} on ${input.orderId ?? ""}.`,
    },
    refund: {
      subject: `Refund ${input.orderId ?? ""}`.trim(),
      body: `A refund was processed on ${input.orderId ?? ""}.`,
    },
    ticket: {
      subject: input.extra?.subject || "Workshop reply",
      body: input.extra?.body || "Update on your ticket.",
    },
    contact: {
      subject: input.extra?.subject || "Website enquiry",
      body: input.extra?.body || "",
    },
  };
  const msg = copy[input.kind] ?? copy.ticket;
  let ticketId: string | undefined;
  if (input.orderId) {
    const { data: existing } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("order_id", input.orderId)
      .maybeSingle();
    ticketId = existing?.id;
  }
  if (!ticketId) {
    const created = await createTicket({
      subject: msg.subject,
      body: msg.body,
      orderId: input.orderId,
      email: input.email,
      name: input.name,
      kind: input.kind,
    });
    return created;
  }
  await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    author_role: "system",
    body: msg.body,
  });
  await supabase
    .from("support_tickets")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  await pushInbox({
    kind: input.kind,
    subject: msg.subject,
    body: msg.body,
    from_email: input.email,
    from_name: input.name,
    ticket_id: ticketId,
    order_id: input.orderId,
  });
  return { id: ticketId };
}

export async function staffListChats() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, user_id, role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const byUser = new Map<string, { user_id: string; preview: string; updated_at: string; count: number }>();
  for (const row of data ?? []) {
    const current = byUser.get(row.user_id);
    if (!current) {
      byUser.set(row.user_id, {
        user_id: row.user_id,
        preview: row.content.slice(0, 140),
        updated_at: row.created_at,
        count: 1,
      });
    } else {
      current.count += 1;
    }
  }
  return [...byUser.values()];
}

export async function staffGetChat(userId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw new Error(error.message);
  return data ?? [];
}
