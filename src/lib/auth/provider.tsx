import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

type AuthState = {
  user: (User & { displayName?: string }) | null;
  session: Session | null;
  isPending: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  isPending: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsPending(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsPending(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user
    ? {
        ...session.user,
        displayName:
          (session.user.user_metadata?.display_name as string | undefined) ??
          (session.user.user_metadata?.full_name as string | undefined) ??
          (session.user.user_metadata?.name as string | undefined) ??
          session.user.email,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, session, isPending }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
