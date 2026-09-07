import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/db";

export type CurrentUser = {
  id: string;
  email: string;
  displayName?: string;
};

type AuthState = {
  user: CurrentUser | null;
  session: Session | null;
  isPending: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  isPending: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isPending: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: toUser(data.session?.user ?? null), session: data.session, isPending: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: toUser(session?.user ?? null), session, isPending: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

function toUser(user: User | null): CurrentUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: (user.user_metadata?.display_name as string) || undefined,
  };
}

export function useAuthState() {
  return useContext(AuthContext);
}
