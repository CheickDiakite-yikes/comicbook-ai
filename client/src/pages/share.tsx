import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import type { Project, Page, Panel, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ComicReader } from "@/components/comic-reader";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Play, Heart, Eye, Calendar, Palette, BookOpen, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SharePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const [showComicReader, setShowComicReader] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Fetch public project data
  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project & { user: User }>({
    queryKey: [`/api/public/projects/${projectId}`],
    retry: false,
  });

  // Fetch project pages
  const { data: pages, isLoading: pagesLoading } = useQuery<Page[]>({
    queryKey: [`/api/public/projects/${projectId}/pages`],
    enabled: !!project,
    retry: false,
  });

  // Fetch project panels  
  const { data: panels, isLoading: panelsLoading } = useQuery<Panel[]>({
    queryKey: [`/api/public/projects/${projectId}/panels`],
    enabled: !!project,
    retry: false,
  });

  const isLoading = projectLoading || pagesLoading || panelsLoading;

  if (projectError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Comic Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This comic doesn't exist or isn't publicly shared.
          </p>
          <Button onClick={() => window.location.href = window.location.origin}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit ComicAI Studio
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Loading Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </header>

        {/* Loading Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-96 w-full rounded-lg mb-6" />
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src={project?.user?.profileImageUrl || ""} />
                <AvatarFallback>
                  {project?.user?.firstName?.charAt(0) || project?.user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">{project?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  by {project?.user?.firstName || project?.user?.email || "Unknown"}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowComicReader(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-read-comic"
            >
              <Play className="mr-2 h-4 w-4" />
              Read Comic
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Comic Preview */}
          {pages && pages.length > 0 && (
            <div className="mb-8">
              <Card className="overflow-hidden">
                <div className="aspect-[8.5/11] bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  {/* Could show first page preview here */}
                  <div className="text-center">
                    <BookOpen className="h-16 w-16 text-primary/50 mx-auto mb-4" />
                    <p className="text-lg font-medium">{pages.length} Page{pages.length !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-muted-foreground">Click "Read Comic" to start</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Project Info Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Description */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-3">About This Comic</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {project?.publicDescription || project?.description || "No description available."}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{pages?.length || 0} pages</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {project?.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Creator Info */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Creator</h3>
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={project?.user?.profileImageUrl || ""} />
                      <AvatarFallback className="text-xs">
                        {project?.user?.firstName?.charAt(0) || project?.user?.email?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {project?.user?.firstName || project?.user?.email || "Unknown"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comic Details */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Details</h3>
                  <div className="space-y-2">
                    {project?.genre && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Genre</span>
                        <Badge variant="secondary">{project.genre}</Badge>
                      </div>
                    )}
                    {project?.artStyle && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Style</span>
                        <Badge variant="outline">{project.artStyle}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Call to Action */}
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
                <CardContent className="p-4 text-center">
                  <Palette className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium mb-1">Create Your Own</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Start making comics with AI assistance
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.location.href = window.location.origin}
                    data-testid="button-create-comic"
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Try ComicAI Studio
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Comic Reader Modal */}
      {showComicReader && pages && panels && (
        <ComicReader
          pages={pages.map(page => ({
            id: page.id,
            pageNumber: page.pageNumber,
            title: page.scriptSnippet || `Page ${page.pageNumber}`,
            layoutTemplate: page.layoutTemplate,
            backgroundImageUrl: page.backgroundImageUrl || undefined,
          }))}
          panels={panels.map(panel => ({
            id: panel.id,
            pageId: panel.pageId,
            panelNumber: panel.panelNumber,
            imageUrl: panel.imageUrl || '',
            action: panel.prompt || `Panel ${panel.panelNumber}`,
          }))}
          currentPageIndex={currentPageIndex}
          onPageChange={setCurrentPageIndex}
          onClose={() => {
            setShowComicReader(false);
            setCurrentPageIndex(0); // Reset to first page when closing
          }}
          projectTitle={project?.title}
        />
      )}
    </div>
  );
}