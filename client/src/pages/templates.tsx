import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import LayoutTemplates from "@/components/layout-templates";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

export default function Templates() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Fetch user's projects for sidebar
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all pages data for the sidebar stats  
  const { data: allPagesData = [] } = useQuery({
    queryKey: ["/api/all-pages"],
    queryFn: async () => {
      const allPages = [];
      for (const project of projects) {
        try {
          const response = await apiRequest("GET", `/api/projects/${project.id}/pages`, undefined);
          const pages = await response.json();
          allPages.push(...pages.map((page: any) => ({ ...page, projectId: project.id })));
        } catch (error) {
          console.error(`Failed to fetch pages for project ${project.id}:`, error);
        }
      }
      return allPages;
    },
    enabled: projects.length > 0,
  });
  
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

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-top)' }}>
      <Navigation 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showMobileToggle={true}
        showDesktopToggle={false}
        sidebarOpen={!sidebarCollapsed}
      />
      
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          allPagesData={allPagesData}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
        
        <main 
          className={`flex-1 overflow-y-auto p-4 sm:p-6 w-full transition-all duration-300 ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}
          style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
          role="main"
          aria-labelledby="templates-heading"
        >
          <header className="mb-6">
            <h1 id="templates-heading" className="text-2xl sm:text-3xl font-serif font-bold mb-2">Panel Templates</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Choose from a variety of comic panel layouts to tell your story</p>
          </header>

          <section aria-labelledby="template-gallery-heading">
            <h2 id="template-gallery-heading" className="sr-only">Template Gallery</h2>
            <LayoutTemplates 
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
            />
          </section>

          {selectedTemplate && (
            <section 
              className="mt-4 sm:mt-6" 
              aria-labelledby="selection-confirmation-heading"
              role="status"
              aria-live="polite"
            >
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6">
                  <h3 id="selection-confirmation-heading" className="font-semibold text-base sm:text-lg mb-2">Template Selected</h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    You've selected the <strong>{selectedTemplate}</strong> template. 
                    This layout will be applied to your next page creation.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
