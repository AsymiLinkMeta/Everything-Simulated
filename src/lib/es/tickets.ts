import { supabase } from "@/lib/db";

export type TicketStatus = "open" | "waiting" | "closed";

export type ServiceTicket = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  order_id: string | null;
  subject: string;
  body: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type ServiceReply = {
  id: number;
  ticket_id: string;
  actor_id: string | null;
  body: string;
  created_at: string;
};

const STAFF = ["sales", "workshop", "content", "support", "admin"];

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user;
}

async function isStaff(userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  return Boolean(data && STAFF.includes(data.role as string));
}

export async function listMyTickets(): Promise<ServiceTicket[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("service_tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceTicket[];
}

export async function createTicket(input: { subject: string; body: string; orderId?: string }) {
  const user = await currentUser();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3) throw new Error("Subject is required");
  if (body.length < 8) throw new Error("Tell us what you need help with");
  const id = `EST-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("service_tickets")
    .insert({
      id,
      user_id: user.id,
      order_id: input.orderId?.trim() || null,
      subject,
      body,
      status: "open",
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ServiceTicket;
}

export async function getTicket(id: string) {
  const user = await currentUser();
  const { data, error } = await supabase.from("service_tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ticket not found");
  if (data.user_id !== user.id && !(await isStaff(user.id))) throw new Error("Ticket not found");
  const replies = await supabase
    .from("service_replies")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  return { ticket: data as ServiceTicket, replies: (replies.data ?? []) as ServiceReply[] };
}

export async function replyToTicket(id: string, body: string) {
  const user = await currentUser();
  const text = body.trim();
  if (!text) throw new Error("Reply required");
  const { error } = await supabase.from("service_replies").insert({ ticket_id: id, actor_id: user.id, body: text });
  if (error) throw new Error(error.message);
  const staff = await isStaff(user.id);
  await supabase
    .from("service_tickets")
    .update({ status: staff ? "waiting" : "open", updated_at: new Date().toISOString() })
    .eq("id", id);
  return { ok: true };
}

export async function staffListTickets(): Promise<ServiceTicket[]> {
  const user = await currentUser();
  if (!(await isStaff(user.id))) throw new Error("Staff access required");
  const { data, error } = await supabase
    .from("service_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceTicket[];
}

export async function staffSetTicketStatus(id: string, status: TicketStatus) {
  const user = await currentUser();
  if (!(await isStaff(user.id))) throw new Error("Staff access required");
  const { error } = await supabase
    .from("service_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
