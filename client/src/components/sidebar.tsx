import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Compass, Users, User, Palette, Wand2, X, PanelLeftClose, PanelLeft, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Project } from "@shared/schema";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  allPagesData?: any[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen = true, onClose, allPagesData = [], isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const recentProjects = projects.slice(0, 2);
  
  // Credit system logic
  const isAdmin = user?.email === "zorovt18@gmail.com";
  const monthlyLimit = isAdmin ? Infinity : 250;
  const currentCredits = isAdmin ? Infinity : 237; // Simulated current usage
  const remainingCredits = isAdmin ? "Unlimited" : currentCredits;
  const creditsPercentage = isAdmin ? 100 : (currentCredits / monthlyLimit) * 100;

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
          ${isCollapsed ? 'w-16' : 'w-64'} bg-card border-r border-border overflow-y-auto fixed left-0 h-screen transition-all duration-300 z-40
          md:translate-x-0 md:block pt-16
          ${onClose ? `mobile-sidebar ${isOpen ? 'open' : ''}` : ''}
          ${!isOpen && onClose ? 'hidden md:block' : ''}
          ${isCollapsed ? 'md:w-16' : 'md:w-64'}
        `}
        style={{ top: '64px', height: 'calc(100vh - 64px)' }}
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
            {/* Collapse Toggle Button */}
            {onToggleCollapse && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="min-h-[44px] w-[44px] p-2 hidden md:flex"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  data-testid="button-sidebar-toggle"
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>
              </div>
            )}
            
            <nav className="space-y-2" role="navigation" aria-label="Main menu">
              {!isCollapsed && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navigation</h3>}
              <ul className="space-y-1" role="list">
                <li role="listitem">
                  <Link href="/">
                    <Button
                      variant="ghost"
                      className={`w-full ${isCollapsed ? 'justify-center px-2' : 'justify-start space-x-3 px-3'} py-3 h-auto min-h-[44px] transition-all ${
                        isActive("/") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-dashboard"
                      title={isCollapsed ? "Dashboard" : undefined}
                    >
                      <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
                      {!isCollapsed && <span>Dashboard</span>}
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/explore">
                    <Button
                      variant="ghost"
                      className={`w-full ${isCollapsed ? 'justify-center px-2' : 'justify-start space-x-3 px-3'} py-3 h-auto min-h-[44px] transition-all ${
                        isActive("/explore") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-explore"
                      title={isCollapsed ? "Explore" : undefined}
                    >
                      <Compass className="w-5 h-5" aria-hidden="true" />
                      {!isCollapsed && <span>Explore</span>}
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/characters">
                    <Button
                      variant="ghost"
                      className={`w-full ${isCollapsed ? 'justify-center px-2' : 'justify-start space-x-3 px-3'} py-3 h-auto min-h-[44px] hover:bg-accent hover:text-accent-foreground transition-all`}
                      data-testid="nav-characters"
                      title={isCollapsed ? "Characters" : undefined}
                    >
                      <Users className="w-5 h-5" aria-hidden="true" />
                      {!isCollapsed && <span>Characters</span>}
                    </Button>
                  </Link>
                </li>
                <li role="listitem">
                  <Link href="/profile">
                    <Button
                      variant="ghost"
                      className={`w-full ${isCollapsed ? 'justify-center px-2' : 'justify-start space-x-3 px-3'} py-3 h-auto min-h-[44px] transition-all ${
                        isActive("/profile") 
                          ? "bg-accent text-accent-foreground" 
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`} 
                      data-testid="nav-profile"
                      title={isCollapsed ? "Profile" : undefined}
                    >
                      <User className="w-5 h-5" aria-hidden="true" />
                      {!isCollapsed && <span>Profile</span>}
                    </Button>
                  </Link>
                </li>
              </ul>
            </nav>

            {!isCollapsed && (
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
            )}

            {!isCollapsed && (
              <section className="pt-4 border-t border-border" aria-labelledby="ai-credits-heading">
                <Card className="bg-gradient-to-r from-chart-1 to-chart-2 text-white border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 id="ai-credits-heading" className="font-semibold text-sm">AI Credits</h3>
                      {isAdmin && (
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-mono">Admin</span>
                      )}
                    </div>
                    <p className="text-xs opacity-90 mt-1">
                      {isAdmin ? "Unlimited" : `${remainingCredits} / ${monthlyLimit} remaining`}
                    </p>
                    {!isAdmin && (
                      <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: `${creditsPercentage}%` }}></div>
                      </div>
                    )}
                    <div className="mt-3 pt-2 border-t border-white/20">
                      <div className="flex items-center space-x-1 mb-1">
                        <Info className="h-3 w-3 opacity-70" />
                        <span className="text-xs opacity-70">How Credits Work</span>
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed">
                        1 credit = 1 panel generation. {!isAdmin && "250 credits refresh monthly."}
                        <br />
                        <span className="opacity-60">More credit options coming soon!</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}
            
            {isCollapsed && (
              <section className="pt-4 border-t border-border flex justify-center">
                <div 
                  className="w-10 h-10 bg-gradient-to-r from-chart-1 to-chart-2 rounded-lg flex items-center justify-center relative" 
                  title={isAdmin ? "AI Credits: Unlimited (Admin)" : `AI Credits: ${remainingCredits}/${monthlyLimit}`}
                >
                  <Wand2 className="w-5 h-5 text-white" />
                  {isAdmin && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <span className="text-xs text-chart-1 font-bold">∞</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
