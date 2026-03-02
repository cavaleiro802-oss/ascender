import { trpc } from "../lib/trpc";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  async function loginWithGoogle(credential: string) {
    await fetch("/api/auth/login/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential }),
    });
    queryClient.invalidateQueries();
  }

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    loginWithGoogle,
    logout: () => logoutMut.mutate(),
  };
}
