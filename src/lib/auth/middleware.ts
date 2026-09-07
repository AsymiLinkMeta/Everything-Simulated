import { createMiddleware } from "@tanstack/react-start";
import { adminClient } from "@/lib/db";

export type AuthContext = {
  userId: string;
  accessToken: string;
};

export const authMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const header =
      request.headers.get("authorization") ??
      request.headers.get("Authorization");
    if (!header) throw new Error("Unauthorized");

    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];
    if (!token) throw new Error("Unauthorized");

    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data.user) throw new Error("Unauthorized");

    return next({
      context: { userId: data.user.id, accessToken: token },
    });
  },
);
