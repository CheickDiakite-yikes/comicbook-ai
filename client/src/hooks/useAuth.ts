import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes - balanced between performance and freshness
    refetchOnWindowFocus: false, // Don't constantly refetch on window focus
    refetchInterval: false, // No background polling
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
