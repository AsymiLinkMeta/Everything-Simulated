import { useAuthState, type CurrentUser } from "./provider";

export function useCurrentUser(): CurrentUser | null {
  return useAuthState().user;
}

export function useCurrentUserState() {
  const { user, isPending } = useAuthState();
  return { user, isPending };
}
