import { Switch, Route } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import SharePage from "@/pages/share";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import Explore from "@/pages/explore";
import Profile from "@/pages/profile";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

export function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/share/:projectId" component={SharePage} />
      <Route path="/comic/:projectId" component={SharePage} />
      <Route path="/login" component={Login} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/explore" component={Explore} />

      {isLoading ? (
        <Route path="/">
          <LoadingScreen />
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
