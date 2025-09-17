import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global quota notification handler - will be set by the app
let globalQuotaHandler: ((error: any) => void) | null = null;

export function setGlobalQuotaHandler(handler: (error: any) => void) {
  globalQuotaHandler = handler;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.log("🔍 API ERROR DETECTED:", { status: res.status, text, hasGlobalHandler: !!globalQuotaHandler });
    
    // Check for quota exceeded errors (HTTP 429)
    if (res.status === 429) {
      console.log("🚨 429 ERROR DETECTED - Processing quota error");
      try {
        // Try to parse the error response to get quota details
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          // If parsing fails, create a basic error structure
          errorData = { error: text };
        }
        
        // Check if this is a quota-related error
        const isQuotaError = (
          text.toLowerCase().includes('quota') ||
          text.toLowerCase().includes('rate limit') ||
          text.toLowerCase().includes('resource_exhausted') ||
          (errorData.errorCategory && errorData.errorCategory === 'quota_exceeded') ||
          (errorData.error && typeof errorData.error === 'object' && errorData.error.code === 429)
        );
        
        console.log("🔍 QUOTA CHECK:", { isQuotaError, hasGlobalHandler: !!globalQuotaHandler, errorData });
        
        if (isQuotaError && globalQuotaHandler) {
          // Extract quota information from the error
          let quotaType = 'general';
          let quotaMessage = 'API quota has been exceeded';
          
          // Parse quota details from Gemini API error structure
          if (errorData.error && errorData.error.details) {
            const violations = errorData.error.details.find((detail: any) => 
              detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure'
            )?.violations;
            
            if (violations && violations.length > 0) {
              const violation = violations[0];
              quotaType = violation.quotaMetric || violation.quotaId || 'daily';
              
              // Make quota type more user-friendly
              if (quotaType.includes('per_day') || quotaType.includes('daily')) {
                quotaType = 'daily';
              } else if (quotaType.includes('per_minute') || quotaType.includes('minute')) {
                quotaType = 'per_minute';
              }
            }
          }
          
          // Extract user-friendly message
          if (errorData.error && errorData.error.message) {
            quotaMessage = errorData.error.message;
          } else if (errorData.message) {
            quotaMessage = errorData.message;
          }
          
          const quotaErrorObj = {
            message: quotaMessage,
            quotaType: quotaType,
            timestamp: new Date(),
            resetTime: quotaType === 'daily' ? 'midnight UTC' : 'a few minutes'
          };
          
          console.log("🚨 TRIGGERING GLOBAL QUOTA HANDLER:", quotaErrorObj);
          
          // Trigger global quota notification
          globalQuotaHandler(quotaErrorObj);
        } else {
          console.log("🚫 NOT TRIGGERING QUOTA HANDLER - Missing conditions");
        }
      } catch (parseError) {
        console.warn('Failed to parse quota error details:', parseError);
        
        // Still trigger quota notification with basic info if this looks like a quota error
        if (text.toLowerCase().includes('quota') && globalQuotaHandler) {
          globalQuotaHandler({
            message: 'API quota has been exceeded. Please try again later.',
            quotaType: 'daily',
            timestamp: new Date(),
            resetTime: 'midnight UTC'
          });
        }
      }
    }
    
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
