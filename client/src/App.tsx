import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import Templates from "@/pages/templates";
import Explore from "@/pages/explore";
import Profile from "@/pages/profile";
import Characters from "@/pages/characters";
import SharePage from "@/pages/share";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes accessible to everyone */}
      <Route path="/share/:projectId" component={SharePage} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/editor/:projectId" component={Editor} />
          <Route path="/templates" component={Templates} />
          <Route path="/explore" component={Explore} />
          <Route path="/profile" component={Profile} />
          <Route path="/characters" component={Characters} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
