import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Compass, Users, User, Palette, Wand2, X } from "lucide-react";
import type { Project } from "@shared/schema";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  allPagesData?: any[];
}

export default function Sidebar({ isOpen = true, onClose, allPagesData = [] }: SidebarProps) {
  const [location] = useLocation();
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const recentProjects = projects.slice(0, 2);

  // Helper function to get page count for a project
  const getProjectPageCount = (projectId: string) => {
    return allPagesData.filter((page: any) => page.projectId === projectId).length;
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div 
          className={`sidebar-overlay md:hidden ${isOpen ? 'open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          w-64 bg-card border-r border-border overflow-y-auto
          md:relative md:translate-x-0 md:block
          ${onClose ? `mobile-sidebar ${isOpen ? 'open' : ''}` : ''}
          ${!isOpen && onClose ? 'hidden md:block' : ''}
        `}
        role="navigation"
        aria-label="Sidebar navigation"
      >
        <div className="p-4">
          {/* Mobile Close Button */}
          {onClose && (
            <div className="flex justify-between items-center mb-4 md:hidden">
              <h2 className="font-semibold text-lg">Menu</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="min-h-[44px] w-[44px] p-2"
                aria-label="Close sidebar"
                data-testid="button-close-sidebar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          )}
          <div className="space-y-6">
            <nav className="space-y-2" role="navigation" aria-label="Main menu">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navigation</h3>
              <ul className="space-y-1" role="list">
                <li role="listitem">
                  <Link href="/">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start space-x-3 p-3 h-auto min-h-[44px] ${
                        isActive("/") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-dashboard"
                    >
                      <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
                      <span>Dashboard</span>
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/explore">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start space-x-3 p-3 h-auto min-h-[44px] ${
                        isActive("/explore") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-explore"
                    >
                      <Compass className="w-5 h-5" aria-hidden="true" />
                      <span>Explore</span>
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/characters">
                    <Button
                      variant="ghost"
                      className="w-full justify-start space-x-3 p-3 h-auto min-h-[44px] hover:bg-accent hover:text-accent-foreground transition-colors" 
                      data-testid="nav-characters"
                    >
                      <Users className="w-5 h-5" aria-hidden="true" />
                      <span>Characters</span>
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/profile">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start space-x-3 p-3 h-auto min-h-[44px] ${
                        isActive("/profile") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-profile"
                    >
                      <User className="w-5 h-5" aria-hidden="true" />
                      <span>Profile</span>
                    </Button>
                  </Link>
                </li>
              </ul>
            </nav>

            <section className="space-y-2" aria-labelledby="recent-projects-heading">
              <h3 id="recent-projects-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Projects</h3>
              <div className="space-y-2">
            {recentProjects.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No projects yet
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link key={project.id} href={`/editor/${project.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full h-auto p-0 border border-border hover:bg-accent cursor-pointer transition-colors min-h-[44px] rounded-lg"
                    data-testid={`nav-recent-${project.id}`}
                  >
                    <div className="p-2 w-full">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-chart-4 rounded flex items-center justify-center flex-shrink-0">
                          <Palette className="text-white text-xs" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium truncate">{project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {getProjectPageCount(project.id)} {getProjectPageCount(project.id) === 1 ? 'page' : 'pages'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Button>
                </Link>
              ))
            )}
              </div>
            </section>

            <section className="pt-4 border-t border-border" aria-labelledby="ai-credits-heading">
              <Card className="bg-gradient-to-r from-chart-1 to-chart-2 text-white border-0">
                <CardContent className="p-4">
                  <h3 id="ai-credits-heading" className="font-semibold text-sm">AI Credits</h3>
                  <p className="text-xs opacity-90 mt-1">847 / 1,000 remaining</p>
                  <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                    <div className="bg-white h-2 rounded-full" style={{ width: "84.7%" }}></div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
