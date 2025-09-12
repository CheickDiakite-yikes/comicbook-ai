import { useState, useEffect } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
// Removed Uppy import as we're now using native file picker
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import { 
  User,
  Edit3,
  Save,
  Upload,
  Globe,
  Lock,
  Settings as SettingsIcon,
  MapPin,
  Link as LinkIcon,
  Mail,
  Calendar,
  Eye,
  Heart
} from "lucide-react";
import type { User as UserType, UserProfile, Project } from "@shared/schema";

interface ProjectWithStats extends Project {
  likesCount: number;
  commentsCount: number;
  pagesCount: number;
}

interface ProfileProps {
  userId?: string; // Optional - if provided, viewing someone else's profile
}

export default function Profile({ userId }: ProfileProps = {}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Start collapsed to avoid blocking content
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: "",
    location: "",
    website: "",
    isPublicProfile: true,
  });

  const [nameData, setNameData] = useState({
    firstName: "",
    lastName: "",
  });

  const toggleSidebarCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleMobileSidebar = () => setSidebarOpen(!sidebarOpen);

  const { user: currentUser } = useAuth();
  
  // Determine if this is the current user's own profile
  const isOwnProfile = !userId || (currentUser && currentUser.id === userId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Image upload mutations
  const updateProfileImageMutation = useMutation({
    mutationFn: async (imageURL: string) => {
      return apiRequest("PUT", "/api/auth/user/profile-image", { imageURL });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Profile image updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update profile image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateBannerImageMutation = useMutation({
    mutationFn: async (imageURL: string) => {
      return apiRequest("PUT", "/api/auth/user/banner-image", { imageURL });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Success", 
        description: "Banner image updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update banner image. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Upload helper functions
  const handleGetUploadParameters = async () => {
    const data = await apiRequest("POST", "/api/upload/presigned-url");
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleProfileImageUpload = (result: { successful: Array<{ uploadURL: string }> }) => {
    if (result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      updateProfileImageMutation.mutate(uploadURL);
    }
  };

  const handleBannerImageUpload = (result: { successful: Array<{ uploadURL: string }> }) => {
    if (result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      updateBannerImageMutation.mutate(uploadURL);
    }
  };

  // Fetch user profile
  const { data: userProfile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    enabled: !!currentUser,
  });

  // Fetch user's public projects
  const { data: userProjects = [], isLoading: projectsLoading } = useQuery<ProjectWithStats[]>({
    queryKey: ["/api/profile/projects"],
    enabled: !!currentUser,
  });

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

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileUpdate: Partial<UserProfile>) => {
      return await fetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify(profileUpdate),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setIsEditing(false);
      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Toggle project public status
  const toggleProjectPublicMutation = useMutation({
    mutationFn: async ({ projectId, isPublic }: { projectId: string; isPublic: boolean }) => {
      return await fetch(`/api/projects/${projectId}/public`, {
        method: "PUT",
        body: JSON.stringify({ isPublic }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/projects"] });
      toast({
        title: "Project updated!",
        description: "Project sharing settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    },
  });

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (userProfile) {
      setProfileData({
        bio: userProfile.bio || "",
        location: userProfile.location || "",
        website: userProfile.website || "",
        isPublicProfile: userProfile.isPublicProfile ?? true,
      });
    }
    if (currentUser) {
      setNameData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
      });
    }
  }, [userProfile, currentUser]);

  const handleSaveProfile = async () => {
    // Save profile data
    updateProfileMutation.mutate(profileData);
    
    // Save name data if changed
    if (nameData.firstName !== (currentUser?.firstName || "") || 
        nameData.lastName !== (currentUser?.lastName || "")) {
      try {
        const response = await fetch("/api/auth/user", {
          method: "PUT", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: nameData.firstName,
            lastName: nameData.lastName,
          }),
        });
        if (response.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
      } catch (error) {
        console.error("Failed to update name:", error);
      }
    }
  };

  const handleEditClick = () => {
    if (userProfile) {
      setProfileData({
        bio: userProfile.bio || "",
        location: userProfile.location || "",
        website: userProfile.website || "",
        isPublicProfile: userProfile.isPublicProfile ?? true,
      });
    }
    if (currentUser) {
      setNameData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (userProfile) {
      setProfileData({
        bio: userProfile.bio || "",
        location: userProfile.location || "",
        website: userProfile.website || "",
        isPublicProfile: userProfile.isPublicProfile ?? true,
      });
    }
    if (currentUser) {
      setNameData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
      });
    }
    setIsEditing(false);
  };

  const handleToggleProjectPublic = (projectId: string, isPublic: boolean) => {
    toggleProjectPublicMutation.mutate({ projectId, isPublic });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground">
              You need to be signed in to view your profile.
            </p>
            <Button onClick={() => window.location.href = "/api/auth/google"} className="mt-4">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center space-x-3">
              <User className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Profile</h1>
                <p className="text-muted-foreground">
                  Manage your profile and sharing settings
                </p>
              </div>
            </div>

            {/* Profile Card */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Profile Information</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {isEditing ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleCancelEdit}
                          data-testid="cancel-edit"
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                          data-testid="save-profile"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {updateProfileMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleEditClick}
                        data-testid="edit-profile"
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Banner Area */}
                <div className="relative h-24 sm:h-32 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg overflow-hidden">
                  {userProfile?.bannerImageUrl ? (
                    <img 
                      src={userProfile.bannerImageUrl} 
                      alt="Profile banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Banner Image</p>
                      </div>
                    </div>
                  )}
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={10485760} // 10MB
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleBannerImageUpload}
                        buttonClassName="bg-black/60 text-white hover:bg-black/70"
                        allowedFileTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload Banner
                      </ObjectUploader>
                    </div>
                  )}
                </div>

                {/* Profile Picture & Basic Info */}
                <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 -mt-10 sm:-mt-8">
                  <div className="relative self-center sm:self-start">
                    <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-background">
                      <AvatarImage src={currentUser?.profileImageUrl || ""} />
                      <AvatarFallback className="text-lg">
                        {currentUser?.firstName?.charAt(0) || currentUser?.email?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && isOwnProfile && (
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={10485760} // 10MB
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleProfileImageUpload}
                        buttonClassName="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 p-0"
                        allowedFileTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
                      >
                        <Upload className="w-2 h-2 sm:w-3 sm:h-3" />
                      </ObjectUploader>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold">
                        {currentUser?.firstName && currentUser?.lastName 
                          ? `${currentUser.firstName} ${currentUser.lastName}`
                          : currentUser?.firstName || currentUser?.email?.split('@')[0] || 'User'
                        }
                      </h2>
                      {isOwnProfile && (
                        <div className="flex items-center justify-center sm:justify-start space-x-1 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{currentUser?.email}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center sm:justify-start space-x-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Joined {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Name Editing */}
                {isEditing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="First name"
                        value={nameData.firstName}
                        onChange={(e) => setNameData({ ...nameData, firstName: e.target.value })}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Last name"
                        value={nameData.lastName}
                        onChange={(e) => setNameData({ ...nameData, lastName: e.target.value })}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                )}

                {/* Profile Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    {isEditing ? (
                      <Textarea
                        id="bio"
                        placeholder="Tell us about yourself..."
                        value={profileData.bio}
                        onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                        rows={3}
                        data-testid="input-bio"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground min-h-[60px] p-3 border rounded-md">
                        {userProfile?.bio || "No bio added yet."}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      {isEditing ? (
                        <Input
                          id="location"
                          placeholder="Your location"
                          value={profileData.location}
                          onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                          data-testid="input-location"
                        />
                      ) : (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{userProfile?.location || "No location set"}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      {isEditing ? (
                        <Input
                          id="website"
                          placeholder="https://your-website.com"
                          value={profileData.website}
                          onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                          data-testid="input-website"
                        />
                      ) : (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <LinkIcon className="w-4 h-4" />
                          {userProfile?.website ? (
                            <a 
                              href={userProfile.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {userProfile.website}
                            </a>
                          ) : (
                            <span>No website set</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Privacy Settings */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Public Profile</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow others to discover and view your public profile
                      </p>
                    </div>
                    <Switch
                      checked={isEditing ? profileData.isPublicProfile : Boolean(userProfile?.isPublicProfile ?? true)}
                      onCheckedChange={(checked) => 
                        isEditing 
                          ? setProfileData({ ...profileData, isPublicProfile: checked })
                          : updateProfileMutation.mutate({ isPublicProfile: checked })
                      }
                      data-testid="switch-public-profile"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projects Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="w-5 h-5" />
                  <span>My Projects</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage which of your projects are shared publicly in the Explore page
                </p>
              </CardHeader>
              
              <CardContent>
                {projectsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                        <div className="space-y-2">
                          <div className="h-5 bg-muted rounded w-32"></div>
                          <div className="h-4 bg-muted rounded w-24"></div>
                        </div>
                        <div className="h-6 bg-muted rounded w-12"></div>
                      </div>
                    ))}
                  </div>
                ) : userProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No projects created yet.</p>
                    <p className="text-sm">Create your first comic to see it here!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userProjects.map((project) => (
                      <div key={project.id} className="group relative">
                        {/* Project Card */}
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-background to-muted">
                          {/* Cover Art or Placeholder */}
                          {project.coverArt ? (
                            <img 
                              src={project.coverArt} 
                              alt={`${project.title} cover`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-secondary/20">
                              <div className="text-center space-y-4">
                                <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                                  <User className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="font-bold text-lg leading-tight text-center" data-testid={`project-name-${project.id}`}>
                                  {project.title}
                                </h3>
                                {project.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-4 text-center">
                                    {project.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Overlay with project info */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                              {project.coverArt && (
                                <h3 className="font-bold text-lg mb-2" data-testid={`project-name-${project.id}`}>
                                  {project.title}
                                </h3>
                              )}
                              {project.description && project.coverArt && (
                                <p className="text-sm text-white/90 line-clamp-3 mb-3">
                                  {project.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Status badges */}
                          <div className="absolute top-3 right-3 flex flex-col gap-2">
                            {project.isPublic && (
                              <Badge variant="default" className="text-xs shadow-lg">
                                <Globe className="w-3 h-3 mr-1" />
                                Public
                              </Badge>
                            )}
                            {project.genre && (
                              <Badge variant="secondary" className="text-xs shadow-lg">
                                {project.genre}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Privacy toggle (owner only) */}
                          {isOwnProfile && (
                            <div className="absolute top-3 left-3">
                              <div className="flex items-center space-x-2 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg">
                                <Label htmlFor={`public-${project.id}`} className="text-xs">
                                  {project.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                </Label>
                                <Switch
                                  id={`public-${project.id}`}
                                  checked={Boolean(project.isPublic)}
                                  onCheckedChange={(checked) => handleToggleProjectPublic(project.id, checked)}
                                  disabled={toggleProjectPublicMutation.isPending}
                                  data-testid={`switch-public-${project.id}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Project stats below the card */}
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="font-medium">{project.pagesCount} pages</span>
                            {project.isPublic && (
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                  <Eye className="w-3 h-3" />
                                  <span>Public</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Heart className="w-3 h-3" />
                                  <span>{project.likesCount}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Project title if cover art exists (since it's in overlay) */}
                          {project.coverArt && (
                            <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                              {project.title}
                            </h3>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}