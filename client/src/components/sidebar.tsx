import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, BookOpen, Users, Settings, Palette, Wand2 } from "lucide-react";
import type { Project } from "@shared/schema";

export default function Sidebar() {
  const [location] = useLocation();
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const recentProjects = projects.slice(0, 2);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="w-64 bg-card border-r border-border p-4 overflow-y-auto">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navigation</h2>
          <nav className="space-y-1">
            <Link href="/">
              <a className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                isActive("/") 
                  ? "bg-accent text-accent-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              }`} data-testid="nav-dashboard">
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </a>
            </Link>
            <Link href="/projects">
              <a className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                isActive("/projects") 
                  ? "bg-accent text-accent-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              }`} data-testid="nav-projects">
                <BookOpen className="w-5 h-5" />
                <span>My Comics</span>
              </a>
            </Link>
            <Link href="/characters">
              <a className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="nav-characters">
                <Users className="w-5 h-5" />
                <span>Characters</span>
              </a>
            </Link>
            <Link href="/settings">
              <a className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="nav-settings">
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </a>
            </Link>
          </nav>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Projects</h2>
          <div className="space-y-2">
            {recentProjects.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No projects yet
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link key={project.id} href={`/editor/${project.id}`}>
                  <Card className="border border-border hover:bg-accent cursor-pointer transition-colors" data-testid={`nav-recent-${project.id}`}>
                    <CardContent className="p-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-chart-4 rounded flex items-center justify-center">
                          <Palette className="text-white text-xs" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{project.title}</p>
                          <p className="text-xs text-muted-foreground">0 pages</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Card className="bg-gradient-to-r from-chart-1 to-chart-2 text-white border-0">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm">AI Credits</h3>
              <p className="text-xs opacity-90 mt-1">847 / 1,000 remaining</p>
              <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                <div className="bg-white h-2 rounded-full" style={{ width: "84.7%" }}></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </aside>
  );
}
