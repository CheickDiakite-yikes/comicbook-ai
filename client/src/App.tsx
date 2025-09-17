import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { BackgroundGenerationProvider } from "@/contexts/BackgroundGenerationContext";
import { QuotaNotificationProvider, useQuotaNotification } from "@/contexts/QuotaNotificationContext";
import { setGlobalQuotaHandler } from "@/lib/queryClient";
import BackgroundGenerationStatus from "@/components/background-generation-status";
import { QuotaNotificationBanner } from "@/components/quota-notification-banner";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import Explore from "@/pages/explore";
import Profile from "@/pages/profile";
import SharePage from "@/pages/share";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import { useEffect } from "react";

function Router() {
  // Safe to run globally now that we've eliminated the infinite 401 loop
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes accessible to everyone */}
      <Route path="/share/:projectId" component={SharePage} />
      <Route path="/comic/:projectId" component={SharePage} />
      <Route path="/login" component={Login} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/explore" component={Explore} />
      
      {/* Main route - Dashboard for authenticated, Landing for unauthenticated */}
      {isLoading ? (
        <Route path="/">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </Route>
      ) : isAuthenticated ? (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/editor/:projectId" component={Editor} />
          <Route path="/profile">
            <Profile />
          </Route>
        </>
      ) : (
        <Route path="/" component={Landing} />
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

// Inner component to access the quota context after it's provided
function AppWithQuotaHandler() {
  const { setQuotaError } = useQuotaNotification();
  
  // Set up the global quota handler when the component mounts
  useEffect(() => {
    setGlobalQuotaHandler(setQuotaError);
    
    // Cleanup function to remove the handler
    return () => {
      setGlobalQuotaHandler(() => {});
    };
  }, [setQuotaError]);
  
  return (
    <>
      <QuotaNotificationBanner />
      <Toaster />
      <BackgroundGenerationStatus />
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <QuotaNotificationProvider>
        <BackgroundGenerationProvider>
          <TooltipProvider>
            <AppWithQuotaHandler />
          </TooltipProvider>
        </BackgroundGenerationProvider>
      </QuotaNotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
