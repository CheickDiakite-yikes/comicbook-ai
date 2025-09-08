import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  Calendar,
  User,
  Compass
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Project, User as UserType, ProjectComment, ProjectLike } from "@shared/schema";

interface PublicProject extends Project {
  user: UserType;
  likesCount: number;
  commentsCount: number;
  isLikedByCurrentUser: boolean;
  previewImageUrl?: string;
}

interface CommentWithUser extends ProjectComment {
  user: UserType;
}

export default function Explore() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Start collapsed to avoid blocking content
  const [selectedProject, setSelectedProject] = useState<PublicProject | null>(null);
  const [newComment, setNewComment] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");

  const toggleSidebarCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleMobileSidebar = () => setSidebarOpen(!sidebarOpen);
  
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Fetch public projects
  const { data: publicProjects = [], isLoading } = useQuery<PublicProject[]>({
    queryKey: ["/api/explore/projects", genreFilter],
  });

  // Fetch comments for selected project
  const { data: projectComments = [] } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/projects", selectedProject?.id, "comments"],
    enabled: !!selectedProject?.id,
  });

  // Like/unlike mutation
  const likeMutation = useMutation({
    mutationFn: async ({ projectId, action }: { projectId: string; action: 'like' | 'unlike' }) => {
      return await fetch(`/api/projects/${projectId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/explore/projects"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive",
      });
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async ({ projectId, comment }: { projectId: string; comment: string }) => {
      return await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject?.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/projects"] });
      setNewComment("");
      toast({
        title: "Comment added!",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive",
      });
    },
  });

  const handleLike = (project: PublicProject) => {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to like projects.",
        variant: "destructive",
      });
      return;
    }

    const action = project.isLikedByCurrentUser ? 'unlike' : 'like';
    likeMutation.mutate({ projectId: project.id, action });
  };

  const handleComment = (project: PublicProject) => {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to comment.",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim()) return;
    
    commentMutation.mutate({ 
      projectId: project.id, 
      comment: newComment.trim() 
    });
  };

  const getGenres = () => {
    const genres = publicProjects.map(p => p.genre).filter(Boolean);
    return Array.from(new Set(genres));
  };

  const filteredProjects = genreFilter === "all" 
    ? publicProjects 
    : publicProjects.filter(p => p.genre === genreFilter);

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-top)' }}>
      <Navigation 
        onToggleSidebar={() => {
          if (window.innerWidth >= 768) {
            toggleSidebarCollapse();
          } else {
            toggleMobileSidebar();
          }
        }}
        showMobileToggle={true}
        showDesktopToggle={true}
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
        >
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-3">
                <Compass className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">Explore Comics</h1>
                  <p className="text-muted-foreground">
                    Discover amazing comics created by our community
                  </p>
                </div>
              </div>

              {/* Genre Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={genreFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenreFilter("all")}
                  data-testid="filter-all"
                >
                  All Genres
                </Button>
                {getGenres().map((genre) => (
                  <Button
                    key={genre}
                    variant={genreFilter === genre ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGenreFilter(genre)}
                    data-testid={`filter-${genre}`}
                  >
                    {genre}
                  </Button>
                ))}
              </div>
            </div>

            {/* Projects Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-muted rounded-t-lg"></div>
                    <CardContent className="p-4 space-y-3">
                      <div className="h-6 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Compass className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Comics Found</h3>
                  <p className="text-muted-foreground">
                    {genreFilter === "all" 
                      ? "No public comics have been shared yet. Be the first to share yours!"
                      : `No comics found in the ${genreFilter} genre.`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <Card key={project.id} className="group hover:shadow-lg transition-shadow duration-200">
                    {/* Preview Image */}
                    <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg overflow-hidden">
                      {project.previewImageUrl ? (
                        <img 
                          src={project.previewImageUrl} 
                          alt={project.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-6xl font-bold text-primary/30">
                            {project.title.charAt(0)}
                          </div>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        {project.genre && (
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            {project.genre}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      {/* Project Title */}
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1" data-testid={`project-title-${project.id}`}>
                          {project.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.publicDescription || project.description || "No description available"}
                        </p>
                      </div>

                      {/* Creator Info */}
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={project.user.profileImageUrl || ""} />
                          <AvatarFallback className="text-xs">
                            {project.user.firstName?.charAt(0) || project.user.email?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          by {project.user.firstName || project.user.email?.split('@')[0] || 'Anonymous'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-4">
                          {/* Like Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLike(project)}
                            disabled={likeMutation.isPending}
                            className={`flex items-center space-x-1 ${
                              project.isLikedByCurrentUser ? 'text-red-500' : 'text-muted-foreground'
                            }`}
                            data-testid={`like-button-${project.id}`}
                          >
                            <Heart className={`w-4 h-4 ${project.isLikedByCurrentUser ? 'fill-current' : ''}`} />
                            <span>{project.likesCount}</span>
                          </Button>

                          {/* Comment Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProject(project)}
                            className="flex items-center space-x-1 text-muted-foreground"
                            data-testid={`comment-button-${project.id}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>{project.commentsCount}</span>
                          </Button>
                        </div>

                        {/* View Comic Button */}
                        <Link href={`/comic/${project.id}`}>
                          <Button size="sm" data-testid={`view-comic-${project.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Comments Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedProject.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">Comments</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProject(null)}
                  data-testid="close-comments"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {/* Comments List */}
              <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                {projectComments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  projectComments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={comment.user.profileImageUrl || ""} />
                        <AvatarFallback className="text-xs">
                          {comment.user.firstName?.charAt(0) || comment.user.email?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">
                            {comment.user.firstName || comment.user.email?.split('@')[0] || 'Anonymous'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Unknown date'}
                          </span>
                        </div>
                        <p className="text-sm">{comment.comment}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment */}
              {currentUser && (
                <div className="border-t p-4 space-y-3">
                  <Textarea
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="resize-none"
                    rows={3}
                    data-testid="comment-input"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleComment(selectedProject)}
                      disabled={!newComment.trim() || commentMutation.isPending}
                      data-testid="post-comment"
                    >
                      {commentMutation.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}