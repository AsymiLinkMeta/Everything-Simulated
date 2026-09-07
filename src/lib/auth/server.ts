import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/db";

export type RequestLike = {
  headers: {
    get(name: string): string | null;
  };
  method: string;
  url: string;
};

function makeRequestLike(req: Request): RequestLike {
  return {
    headers: req.headers,
    method: req.method,
    url: req.url,
  };
}

export const auth = {
  async handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/auth\/?/, "");

    if (path === "signup" && request.method === "POST") {
      const body = await request.json();
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.signUp({
        email: body.email,
        password: body.password,
        options: { data: { display_name: body.name } },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ user: data.user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "signin" && request.method === "POST") {
      const body = await request.json();
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          user: data.user,
          session: data.session,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (path === "oauth" && request.method === "POST") {
      const body = await request.json();
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.signInWithOAuth({
        provider: body.provider,
        options: { redirectTo: body.redirectTo },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ url: data.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "signout" && request.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

export { makeRequestLike };
