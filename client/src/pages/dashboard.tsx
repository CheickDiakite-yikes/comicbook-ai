import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import CreateProjectModal from "@/components/create-project-modal";
import EditProjectModal from "@/components/edit-project-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Clock, Users, Settings } from "lucide-react";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Close sidebar on mobile when screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch actual page counts for each project
  const { data: allPagesData = [] } = useQuery({
    queryKey: ["/api/all-pages"],
    queryFn: async () => {
      const allPages = [];
      for (const project of projects) {
        try {
          const pages = await fetch(`/api/projects/${project.id}/pages`).then(res => res.json());
          allPages.push(...pages.map((page: any) => ({ ...page, projectId: project.id })));
        } catch (error) {
          console.error(`Failed to fetch pages for project ${project.id}:`, error);
        }
      }
      return allPages;
    },
    enabled: projects.length > 0,
  });

  // Helper function to get page count for a specific project
  const getProjectPageCount = (projectId: string) => {
    return allPagesData.filter((page: any) => page.projectId === projectId).length;
  };

  const totalPages = allPagesData.length;
  const totalCharacters = projects.reduce((acc, project) => {
    const projectPages = allPagesData.filter((page: any) => page.projectId === project.id);
    return acc + projectPages.length * 3; // Estimate 3 characters per page
  }, 0);

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-top)' }}>
      <Navigation onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showMobileToggle={true} />
      
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main 
          className="flex-1 overflow-y-auto p-4 sm:p-6 w-full md:w-auto"
          style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
        >
          {/* Welcome Section */}
          <section className="mb-6 sm:mb-8" aria-labelledby="welcome-heading">
            <h1 id="welcome-heading" className="text-2xl sm:text-3xl font-serif font-bold mb-2">Welcome back! 👋</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Ready to create something amazing? Let's bring your stories to life.</p>
          </section>

          {/* Quick Actions */}
          <section className="mb-6 sm:mb-8" aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="sr-only">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Button
                variant="ghost"
                className="bg-gradient-to-br from-chart-1 to-chart-2 text-white cursor-pointer hover:shadow-lg transition-shadow border-0 h-auto p-0 rounded-lg min-h-[120px]"
                onClick={() => setShowCreateModal(true)}
                data-testid="card-create-comic"
                aria-label="Create new comic project"
              >
                <CardContent className="p-4 sm:p-6 w-full">
                  <div className="flex items-center justify-between mb-4">
                    <Plus className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden="true" />
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs sm:text-sm">New</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Create Comic</h3>
                  <p className="text-white/80 text-xs sm:text-sm">Start a new comic project with AI assistance</p>
                </CardContent>
              </Button>
            
              <Link href="/templates">
                <Button
                  variant="ghost"
                  className="bg-gradient-to-br from-chart-3 to-chart-4 text-white cursor-pointer hover:shadow-lg transition-shadow border-0 h-auto p-0 rounded-lg min-h-[120px] w-full"
                  aria-label="Browse panel templates"
                >
                  <CardContent className="p-4 sm:p-6 w-full">
                    <div className="flex items-center justify-between mb-4">
                      <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                      </svg>
                      <span className="bg-white/20 px-2 py-1 rounded-full text-xs sm:text-sm">Browse</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-2">Panel Templates</h3>
                    <p className="text-white/80 text-xs sm:text-sm">Explore layout options for your pages</p>
                  </CardContent>
                </Button>
              </Link>

              <Button
                variant="ghost"
                className="bg-gradient-to-br from-chart-5 to-destructive text-white cursor-pointer hover:shadow-lg transition-shadow border-0 h-auto p-0 rounded-lg min-h-[120px]"
                aria-label="Generate AI ideas"
                onClick={() => setShowCreateModal(true)}
              >
                <CardContent className="p-4 sm:p-6 w-full">
                  <div className="flex items-center justify-between mb-4">
                    <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs sm:text-sm">AI</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Generate Ideas</h3>
                  <p className="text-white/80 text-xs sm:text-sm">Get AI-powered story and character suggestions</p>
                </CardContent>
              </Button>
            </div>
          </section>

          {/* Recent Projects */}
          <section className="mb-6 sm:mb-8" aria-labelledby="recent-projects-heading">
            <div className="flex items-center justify-between mb-4">
              <h2 id="recent-projects-heading" className="text-xl sm:text-2xl font-serif font-semibold">Recent Projects</h2>
              <Button variant="ghost" className="text-primary hover:underline text-sm font-medium min-h-[44px]">
                View all
              </Button>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-4 animate-pulse" />
                      <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
                      <div className="h-3 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {projects.map((project) => (
                  <div key={project.id} className="relative group">
                    <Link href={`/editor/${project.id}`}>
                      <Button
                        variant="ghost"
                        className="border-border hover:shadow-lg transition-shadow cursor-pointer h-auto p-0 w-full rounded-lg min-h-[200px]"
                        data-testid={`card-project-${project.id}`}
                      >
                        <div className="w-full">
                          <div className="aspect-video bg-gradient-to-br from-chart-1/20 to-chart-2/20 flex items-center justify-center rounded-t-lg">
                            <div className="text-center">
                              <svg className="h-10 w-10 sm:h-12 sm:w-12 text-chart-1 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              <p className="text-sm text-muted-foreground">
                                {getProjectPageCount(project.id)} pages created
                              </p>
                            </div>
                          </div>
                          <div className="p-4 text-left">
                            <h3 className="font-semibold text-base sm:text-lg mb-1">{project.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">
                              {project.description || "No description available"}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                <span>Just created</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="bg-chart-4 w-2 h-2 rounded-full" aria-hidden="true"></span>
                                <span className="bg-chart-5 w-2 h-2 rounded-full" aria-hidden="true"></span>
                                <span className="bg-chart-1 w-2 h-2 rounded-full" aria-hidden="true"></span>
                                <span className="text-xs text-muted-foreground ml-2">3 characters</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Button>
                    </Link>
                    
                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background/90 w-8 h-8 p-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingProject(project);
                      }}
                      data-testid={`button-edit-project-${project.id}`}
                      aria-label="Edit project"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {/* Add new project card */}
                <Button
                  variant="ghost"
                  className="border-border border-dashed hover:shadow-lg transition-shadow cursor-pointer flex items-center justify-center aspect-[4/3] h-auto p-0 rounded-lg min-h-[200px]"
                  onClick={() => setShowCreateModal(true)}
                  data-testid="card-add-project"
                  aria-label="Start new project"
                >
                  <div className="p-4 sm:p-6 text-center">
                    <Plus className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4 mx-auto" aria-hidden="true" />
                    <p className="text-muted-foreground font-medium text-sm sm:text-base">Start New Project</p>
                  </div>
                </Button>
              </div>
            )}
          </section>

          {/* Statistics */}
          <section aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">Project Statistics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Comics</p>
                      <p className="text-lg sm:text-2xl font-bold" data-testid="stat-total-comics">{projects.length}</p>
                    </div>
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-chart-1 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z"/>
                    </svg>
                  </div>
                </CardContent>
              </Card>
            
              <Card className="border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Pages Created</p>
                      <p className="text-lg sm:text-2xl font-bold" data-testid="stat-pages-created">{totalPages}</p>
                    </div>
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-chart-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                  </div>
                </CardContent>
              </Card>
            
              <Card className="border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Characters</p>
                      <p className="text-lg sm:text-2xl font-bold" data-testid="stat-characters">{totalCharacters}</p>
                    </div>
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-chart-3 flex-shrink-0" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            
              <Card className="border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">AI Generations</p>
                      <p className="text-lg sm:text-2xl font-bold" data-testid="stat-ai-generations">0</p>
                    </div>
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7,21L12,9L17,21H7M12,2L13.09,8.26L22,9L17,14L18.18,22.74L12,19.77L5.82,22.74L7,14L2,9L10.91,8.26L12,2Z"/>
                    </svg>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>

      <CreateProjectModal 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      
      {editingProject && (
        <EditProjectModal 
          open={!!editingProject} 
          onClose={() => setEditingProject(null)} 
          project={editingProject}
        />
      )}
    </div>
  );
}
