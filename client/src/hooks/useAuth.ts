import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30 * 1000, // Check authentication every 30 seconds instead of caching forever
    refetchOnWindowFocus: true, // Re-check auth when user returns to tab
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
