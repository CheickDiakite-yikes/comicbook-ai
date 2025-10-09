import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";
import { queryClient } from "@/lib/queryClient";
import { QuotaNotificationProvider } from "@/contexts/QuotaNotificationContext";
import { BackgroundGenerationProvider } from "@/contexts/BackgroundGenerationContext";
import { AnimationStatusProvider } from "@/contexts/AnimationStatusContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuotaNotificationProvider>
        <BackgroundGenerationProvider>
          <AnimationStatusProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AnimationStatusProvider>
        </BackgroundGenerationProvider>
      </QuotaNotificationProvider>
    </QueryClientProvider>
  );
}
