import { useAuth } from "./provider";

export function useCurrentUserState() {
  const { user, isPending } = useAuth();
  return { user, isPending };
}

export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}
