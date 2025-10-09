import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";
import { queryClient } from "@/lib/queryClient";
import { QuotaNotificationProvider } from "@/contexts/QuotaNotificationContext";
import { BackgroundGenerationProvider } from "@/contexts/BackgroundGenerationContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuotaNotificationProvider>
        <BackgroundGenerationProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </BackgroundGenerationProvider>
      </QuotaNotificationProvider>
    </QueryClientProvider>
  );
}
