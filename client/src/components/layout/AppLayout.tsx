import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import BackgroundGenerationStatus from "@/components/background-generation-status";
import { QuotaNotificationBanner } from "@/components/quota-notification-banner";
import { useQuotaNotification } from "@/contexts/QuotaNotificationContext";
import { setGlobalQuotaHandler } from "@/lib/queryClient";
import { AppRouter } from "@/routing/AppRouter";

export function AppLayout() {
  const { setQuotaError, isCurrentlyVisible } = useQuotaNotification();

  useEffect(() => {
    setGlobalQuotaHandler(setQuotaError);

    return () => {
      setGlobalQuotaHandler(() => {});
    };
  }, [setQuotaError]);

  return (
    <>
      <QuotaNotificationBanner />
      <div className={isCurrentlyVisible() ? "pt-20 sm:pt-16" : ""}>
        <Toaster />
        <BackgroundGenerationStatus />
        <AppRouter />
      </div>
    </>
  );
}
