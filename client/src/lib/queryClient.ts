import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Debug the response
  if (url.includes('redress-character')) {
    console.log('🔍 DEBUG: Raw response status:', res.status);
    console.log('🔍 DEBUG: Raw response headers:', Object.fromEntries(res.headers.entries()));
    const responseText = await res.text();
    console.log('🔍 DEBUG: Raw response text:', responseText);
    
    try {
      const parsed = JSON.parse(responseText);
      console.log('🔍 DEBUG: Parsed JSON:', parsed);
      return parsed;
    } catch (parseError) {
      console.error('🔍 DEBUG: JSON parse error:', parseError);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }
  
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Global error handler for 401s - REMOVED infinite loop
// Instead of invalidating auth on every 401, we let individual components handle auth state
// This prevents the infinite loop where 401 → invalidate → retry → 401 → invalidate...
