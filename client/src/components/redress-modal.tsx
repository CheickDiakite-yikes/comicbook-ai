import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Shirt,
  Palette,
  Eye,
  Coins,
  Loader2,
  Check,
  AlertTriangle,
  User,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  Users,
  CheckSquare,
  Square,
} from "lucide-react";
import type { Character, Panel } from "@shared/schema";

// Outfit preset configurations
const OUTFIT_PRESETS = [
  {
    id: "casual-modern",
    name: "Casual Modern",
    type: "casual wear",
    style: "modern contemporary",
    colors: ["#2563eb", "#ffffff", "#64748b"],
    description: "Modern casual outfit with jeans and t-shirt",
    thumbnail: "👕",
  },
  {
    id: "formal-business",
    name: "Business Formal",
    type: "business suit",
    style: "professional formal",
    colors: ["#1f2937", "#ffffff", "#374151"],
    description: "Professional business attire with suit and tie",
    thumbnail: "👔",
  },
  {
    id: "fantasy-medieval",
    name: "Medieval Fantasy",
    type: "fantasy clothing",
    style: "medieval fantasy",
    colors: ["#7c2d12", "#fbbf24", "#065f46"],
    description: "Medieval fantasy clothing with robes and leather",
    thumbnail: "🏰",
  },
  {
    id: "sci-fi-futuristic",
    name: "Sci-Fi Future",
    type: "futuristic clothing",
    style: "cyberpunk futuristic",
    colors: ["#1e1b4b", "#06b6d4", "#a855f7"],
    description: "Futuristic sci-fi outfit with tech elements",
    thumbnail: "🚀",
  },
  {
    id: "vintage-retro",
    name: "Vintage Retro",
    type: "vintage clothing",
    style: "retro vintage",
    colors: ["#dc2626", "#fbbf24", "#0369a1"],
    description: "Retro vintage style from past decades",
    thumbnail: "📻",
  },
  {
    id: "elegant-evening",
    name: "Elegant Evening",
    type: "evening_wear",
    style: "elegant formal",
    colors: ["#000000", "#ffd700", "#dc2626"],
    description: "Elegant evening attire for special occasions",
    thumbnail: "✨",
  },
];

// Available colors for custom outfits
const COLOR_PALETTE = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#fbbf24",
  "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb",
  "#7c3aed", "#db2777", "#374151", "#f59e0b", "#b91c1c", "#9a3412",
];

// Redress request schema
const redressSchema = z.object({
  characters: z.array(z.object({
    characterId: z.string(),
    referenceImageUrl: z.string().optional(),
  })).min(1, "Select at least one character"),
  outfit: z.object({
    type: z.string().min(1, "Outfit type is required"),
    style: z.string().min(1, "Style is required"),
    colors: z.array(z.string()).min(1, "Select at least one color"),
    pattern: z.string().optional(),
    fabric: z.string().optional(),
    description: z.string().optional(),
  }),
  strength: z.number().min(1).max(100).default(75),
  preview: z.boolean().default(false),
});

type RedressFormData = z.infer<typeof redressSchema>;

interface RedressJob {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  previewUrl?: string;
  finalUrl?: string;
  errorMessage?: string;
  processingSteps?: Array<{
    step: string;
    status: "pending" | "processing" | "completed" | "failed";
    message?: string;
    timestamp?: Date;
  }>;
}

interface RedressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
  characters: Character[];
  onSuccess?: (newImageUrl: string) => void;
}

export function RedressModal({
  open,
  onOpenChange,
  panelId,
  characters,
  onSuccess,
}: RedressModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState<"characters" | "outfit" | "preview">("characters");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [currentJob, setCurrentJob] = useState<RedressJob | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  
  // Character selection state
  const [searchTerm, setSearchTerm] = useState("");
  const [showPanelCharactersOnly, setShowPanelCharactersOnly] = useState(true);
  
  // Panel character detection - for now we'll use a mock implementation
  // In a real app, this would come from panel generation data or face recognition
  const panelCharacterIds = useMemo(() => {
    // Mock implementation: assume first 2-3 characters are in panel
    // This would be replaced with actual panel character detection logic
    return characters.slice(0, Math.min(3, characters.length)).map(c => c.id);
  }, [characters]);
  
  // Filtered and sorted characters with panel filter UX improvements
  const filteredCharacters = useMemo(() => {
    let filtered = characters.filter((character) =>
      character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (character.role && character.role.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    if (showPanelCharactersOnly) {
      const panelFiltered = filtered.filter(character => panelCharacterIds.includes(character.id));
      // If no panel characters found but we have search results, fall back to all characters
      if (panelFiltered.length === 0 && filtered.length > 0) {
        // Auto-disable panel filter to show results (async to avoid state update during render)
        setTimeout(() => setShowPanelCharactersOnly(false), 0);
        return filtered; // Return unfiltered results immediately for better UX
      }
      filtered = panelFiltered;
    }
    
    // Sort to show panel characters first, then others
    return filtered.sort((a, b) => {
      const aInPanel = panelCharacterIds.includes(a.id);
      const bInPanel = panelCharacterIds.includes(b.id);
      
      if (aInPanel && !bInPanel) return -1;
      if (!aInPanel && bInPanel) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [characters, searchTerm, showPanelCharactersOnly, panelCharacterIds]);

  // Fetch current user credits
  const { data: creditData } = useQuery<{
    isAdmin: boolean;
    monthlyLimit: number | null;
    currentCredits: number | null;
    remainingCredits: string | number;
    creditsPercentage: number;
  }>({
    queryKey: ["/api/credits"],
  });

  const form = useForm<RedressFormData>({
    resolver: zodResolver(redressSchema),
    defaultValues: {
      characters: [],
      outfit: {
        type: "",
        style: "",
        colors: [],
        description: "",
      },
      strength: 75,
      preview: false,
    },
  });

  // Poll job status with exponential backoff and error handling
  const { data: jobStatus, error: jobError, refetch: refetchJobStatus } = useQuery<RedressJob>({
    queryKey: ["redress-job", pollingJobId],
    enabled: !!pollingJobId && open, // Only poll when modal is open
    refetchInterval: (data) => {
      // Stop polling on completion or failure
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      
      return 2000; // Poll every 2 seconds
    },
    retry: (failureCount, error) => {
      // Retry up to 3 times, but not for 404s (job not found)
      if (error && 'status' in error && error.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Cleanup polling when modal closes
  useEffect(() => {
    if (!open) {
      setPollingJobId(null);
      setCurrentJob(null);
    }
  }, [open]);

  // Update current job when polling data changes
  useEffect(() => {
    if (jobStatus) {
      setCurrentJob(jobStatus);
      
      if (jobStatus.status === "completed") {
        setPollingJobId(null);
        if (jobStatus.finalUrl && onSuccess) {
          onSuccess(jobStatus.finalUrl);
        }
        toast({
          title: "Outfit Change Complete!",
          description: "Your characters have been successfully redressed.",
        });
      } else if (jobStatus.status === "failed") {
        setPollingJobId(null);
        toast({
          title: "Outfit Change Failed",
          description: jobStatus.errorMessage || "Something went wrong during processing.",
          variant: "destructive",
        });
      }
    }
  }, [jobStatus, onSuccess, toast]);

  // Handle polling errors
  useEffect(() => {
    if (jobError && pollingJobId) {
      console.error("Job polling error:", jobError);
      // Don't show error toast immediately - let retry logic handle it
      // Only show if all retries failed
      if (jobError && 'status' in jobError && jobError.status === 404) {
        setPollingJobId(null);
        setCurrentJob(null);
        toast({
          title: "Job Not Found",
          description: "The redress job could not be found. It may have expired.",
          variant: "destructive",
        });
      }
    }
  }, [jobError, pollingJobId, toast]);

  // Preview mutation (1 credit)
  const previewMutation = useMutation({
    mutationFn: async (data: RedressFormData) => {
      const response = await apiRequest("POST", `/api/panels/${panelId}/redress`, {
        ...data,
        preview: true,
      });
      return response.json();
    },
    onSuccess: (result: RedressJob) => {
      setCurrentJob(result);
      setPollingJobId(result.jobId);
      setCurrentStep("preview");
      toast({
        title: "Preview Started",
        description: "Generating outfit preview... This will take a moment.",
      });
    },
    onError: (error) => {
      console.error("Preview failed:", error);
      toast({
        title: "Preview Failed",
        description: "Unable to generate preview. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Apply mutation (3 credits)
  const applyMutation = useMutation({
    mutationFn: async (data: RedressFormData) => {
      const response = await apiRequest("POST", `/api/panels/${panelId}/redress`, {
        ...data,
        preview: false,
      });
      return response.json();
    },
    onSuccess: (result: RedressJob) => {
      setCurrentJob(result);
      setPollingJobId(result.jobId);
      toast({
        title: "Applying Changes",
        description: "Finalizing your outfit changes... This may take a few minutes.",
      });
      
      // Invalidate panel queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
    },
    onError: (error) => {
      console.error("Apply failed:", error);
      toast({
        title: "Apply Failed",
        description: "Unable to apply changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle preset selection
  const handlePresetSelect = (preset: typeof OUTFIT_PRESETS[0]) => {
    setSelectedPreset(preset.id);
    setSelectedColors(preset.colors);
    
    form.setValue("outfit", {
      type: preset.type,
      style: preset.style,
      colors: preset.colors,
      description: preset.description,
    });
  };

  // Handle color selection
  const handleColorToggle = (color: string) => {
    const currentColors = selectedColors;
    let newColors;
    
    if (currentColors.includes(color)) {
      newColors = currentColors.filter(c => c !== color);
    } else {
      newColors = [...currentColors, color];
    }
    
    setSelectedColors(newColors);
    form.setValue("outfit.colors", newColors);
  };

  // Handle character selection
  const handleCharacterToggle = (character: Character) => {
    const currentCharacters = form.getValues("characters");
    const isSelected = currentCharacters.some(c => c.characterId === character.id);
    
    let newCharacters;
    if (isSelected) {
      newCharacters = currentCharacters.filter(c => c.characterId !== character.id);
    } else {
      newCharacters = [...currentCharacters, {
        characterId: character.id,
        referenceImageUrl: character.referenceImageUrl || undefined,
      }];
    }
    
    form.setValue("characters", newCharacters);
  };
  
  // Bulk selection handlers
  const handleSelectAll = () => {
    const allCharacterSelections = filteredCharacters.map(character => ({
      characterId: character.id,
      referenceImageUrl: character.referenceImageUrl || undefined,
    }));
    form.setValue("characters", allCharacterSelections);
  };
  
  const handleClearAll = () => {
    form.setValue("characters", []);
  };
  
  const selectedCount = form.getValues("characters").length;
  const filteredCount = filteredCharacters.length;

  // Submit handlers
  const handlePreview = () => {
    const formData = form.getValues();
    previewMutation.mutate(formData);
  };

  const handleApply = () => {
    const formData = form.getValues();
    applyMutation.mutate(formData);
  };

  // Step navigation
  const handleNextStep = () => {
    if (currentStep === "characters") {
      const selectedCharacters = form.getValues("characters");
      if (selectedCharacters.length === 0) {
        toast({
          title: "No Characters Selected",
          description: "Please select at least one character to continue.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("outfit");
    } else if (currentStep === "outfit") {
      const outfit = form.getValues("outfit");
      if (!outfit.type || !outfit.style || outfit.colors.length === 0) {
        toast({
          title: "Incomplete Outfit",
          description: "Please complete the outfit configuration to continue.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep("preview");
    }
  };

  const handlePrevStep = () => {
    if (currentStep === "outfit") {
      setCurrentStep("characters");
    } else if (currentStep === "preview") {
      setCurrentStep("outfit");
    }
  };

  const handleClose = () => {
    // Reset form and state
    form.reset();
    setCurrentStep("characters");
    setSelectedPreset(null);
    setSelectedColors([]);
    setCurrentJob(null);
    setPollingJobId(null);
    // Reset search and filter state
    setSearchTerm("");
    setShowPanelCharactersOnly(true);
    onOpenChange(false);
  };

  // Credit calculations (variable costs for proper TypeScript checks)
  const previewCost = 1 as number;
  const applyCost = 3 as number;
  const currentCredits = typeof creditData?.remainingCredits === 'number' 
    ? creditData.remainingCredits 
    : parseInt(creditData?.remainingCredits as string) || 0;
  const hasEnoughForPreview = creditData?.isAdmin || currentCredits >= previewCost;
  const hasEnoughForApply = creditData?.isAdmin || currentCredits >= applyCost;

  // Responsive container component
  const ModalContainer = isMobile ? Drawer : Dialog;
  const ModalContentComponent = isMobile ? DrawerContent : DialogContent;
  const ModalHeaderComponent = isMobile ? DrawerHeader : DialogHeader;
  const ModalFooterComponent = isMobile ? DrawerFooter : DialogFooter;
  const ModalTitleComponent = isMobile ? DrawerTitle : DialogTitle;
  const ModalDescriptionComponent = isMobile ? DrawerDescription : DialogDescription;
  
  return (
    <ModalContainer open={open} onOpenChange={onOpenChange}>
      <ModalContentComponent className={isMobile ? "max-h-[90vh] overflow-hidden" : "max-w-4xl max-h-[90vh] overflow-hidden"} data-testid="redress-modal">
        <ModalHeaderComponent className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <ModalTitleComponent className="flex items-center gap-2" data-testid="modal-title">
                <Shirt className="h-5 w-5" />
                Change Character Outfits
              </ModalTitleComponent>
              <ModalDescriptionComponent data-testid="modal-description">
                Select characters and customize their clothing using AI-powered outfit generation
              </ModalDescriptionComponent>
            </div>
            
            {/* Credit Display */}
            <div className="flex items-center gap-2">
              <div className="text-right text-sm" data-testid="credit-display">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Coins className="h-4 w-4" />
                  {creditData?.isAdmin ? "Unlimited" : `${currentCredits} credits`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Preview: {previewCost}c • Apply: {applyCost}c
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-4 mt-4">
            <div className={`flex items-center gap-2 ${currentStep === "characters" ? "text-primary" : currentStep === "outfit" || currentStep === "preview" ? "text-muted-foreground" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium ${currentStep === "characters" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                1
              </div>
              <span className="text-sm">Characters</span>
            </div>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            
            <div className={`flex items-center gap-2 ${currentStep === "outfit" ? "text-primary" : currentStep === "preview" ? "text-muted-foreground" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium ${currentStep === "outfit" ? "border-primary bg-primary text-primary-foreground" : currentStep === "preview" ? "border-muted-foreground" : "border-muted-foreground"}`}>
                2
              </div>
              <span className="text-sm">Outfit</span>
            </div>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            
            <div className={`flex items-center gap-2 ${currentStep === "preview" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium ${currentStep === "preview" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                3
              </div>
              <span className="text-sm">Preview & Apply</span>
            </div>
          </div>
        </ModalHeaderComponent>

        <div className="flex-1 overflow-y-auto p-6">
          <Form {...form}>
            {/* Step 1: Character Selection */}
            {currentStep === "characters" && (
              <div className="space-y-4">
                {/* Header and Stats */}
                <div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="character-selection-title">
                    Select Characters to Redress
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose which characters should have their outfits changed.
                  </p>
                  
                  {/* Selection Stats */}
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="outline" className="text-sm" data-testid="selection-count">
                      <Users className="h-4 w-4 mr-1" />
                      {selectedCount} of {filteredCount} selected
                    </Badge>
                    {panelCharacterIds.length > 0 && (
                      <Badge variant="secondary" className="text-sm">
                        <Eye className="h-4 w-4 mr-1" />
                        {panelCharacterIds.length} in panel
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Search and Filter Controls */}
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      placeholder="Search characters by name or role..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-12 text-base min-h-[48px]" // Larger for mobile with proper touch targets
                      data-testid="character-search-input"
                      aria-label="Search characters by name or role"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 p-0 min-h-[48px] min-w-[48px] flex items-center justify-center"
                        data-testid="clear-search-button"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Filter and Bulk Action Row */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Panel Filter Toggle */}
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        id="panel-characters-only"
                        checked={showPanelCharactersOnly}
                        onCheckedChange={setShowPanelCharactersOnly}
                        data-testid="panel-characters-filter"
                        aria-describedby="panel-filter-description"
                        className="min-h-[48px] min-w-[48px] data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <Label htmlFor="panel-characters-only" className="text-sm cursor-pointer min-h-[48px] flex items-center" id="panel-filter-description">
                        Only show characters in this panel
                      </Label>
                    </div>
                    
                    {/* Bulk Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={filteredCharacters.length === 0}
                        className="h-12 min-h-[48px] px-4"
                        data-testid="select-all-button"
                        aria-label={`Select all ${filteredCharacters.length} filtered characters`}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" aria-hidden="true" />
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        disabled={selectedCount === 0}
                        className="h-12 min-h-[48px] px-4"
                        data-testid="clear-all-button"
                        aria-label={`Clear all ${selectedCount} selected characters`}
                      >
                        <Square className="h-4 w-4 mr-2" aria-hidden="true" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Mobile-First Character Grid */}
                {filteredCharacters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="character-grid">
                    {filteredCharacters.map((character) => {
                      const isSelected = form.getValues("characters").some(c => c.characterId === character.id);
                      const inPanel = panelCharacterIds.includes(character.id);
                      
                      return (
                        <Card
                          key={character.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-95 touch-manipulation ${
                            isSelected ? "ring-2 ring-primary bg-primary/10 border-primary" : "hover:border-muted-foreground/50"
                          }`}
                          onClick={() => handleCharacterToggle(character)}
                          data-testid={`character-card-${character.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              {/* Large Avatar */}
                              <div className="relative flex-shrink-0">
                                <Avatar className="h-14 w-14 border-2 border-background">
                                  <AvatarImage src={character.referenceImageUrl || undefined} />
                                  <AvatarFallback className="text-lg font-semibold">
                                    {character.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                
                                {/* Selection Indicator */}
                                <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center transition-all ${
                                  isSelected 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-muted border-muted-foreground/30"
                                }`}>
                                  {isSelected ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                  )}
                                </div>
                                
                                {/* Panel Indicator */}
                                {inPanel && (
                                  <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-blue-500 text-white rounded-full border-2 border-background flex items-center justify-center">
                                    <Eye className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Character Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-base truncate" data-testid={`character-name-${character.id}`}>
                                    {character.name}
                                  </h4>
                                  {inPanel && (
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                                      In Panel
                                    </Badge>
                                  )}
                                </div>
                                
                                {character.role && (
                                  <p className="text-sm text-muted-foreground capitalize mb-2">
                                    {character.role}
                                  </p>
                                )}
                                
                                {/* Current Outfit Info */}
                                {character.currentOutfit && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {typeof character.currentOutfit === 'string' 
                                          ? character.currentOutfit 
                                          : 'Custom outfit'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    {characters.length === 0 ? (
                      <>
                        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h4 className="font-medium text-muted-foreground mb-2">No Characters Found</h4>
                        <p className="text-sm text-muted-foreground">
                          No characters are available for this panel. Add characters to your project first.
                        </p>
                      </>
                    ) : (
                      <>
                        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h4 className="font-medium text-muted-foreground mb-2">No Characters Match</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          No characters found matching "{searchTerm}"
                          {showPanelCharactersOnly && " in this panel"}.
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSearchTerm("");
                            setShowPanelCharactersOnly(false);
                          }}
                          data-testid="reset-filters-button"
                        >
                          Reset Filters
                        </Button>
                      </>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* Step 2: Outfit Configuration */}
            {currentStep === "outfit" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3" data-testid="outfit-configuration-title">
                    Configure Outfit
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose a preset or customize the outfit details for selected characters.
                  </p>
                </div>

                <Tabs defaultValue="presets" className="w-full">
                  <TabsList className="grid w-full grid-cols-2" data-testid="outfit-tabs">
                    <TabsTrigger value="presets" data-testid="presets-tab">Outfit Presets</TabsTrigger>
                    <TabsTrigger value="custom" data-testid="custom-tab">Custom Outfit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="presets" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="preset-grid">
                      {OUTFIT_PRESETS.map((preset) => (
                        <Card
                          key={preset.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedPreset === preset.id ? "ring-2 ring-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handlePresetSelect(preset)}
                          data-testid={`preset-card-${preset.id}`}
                        >
                          <CardContent className="p-4 text-center">
                            <div className="text-3xl mb-2">{preset.thumbnail}</div>
                            <h4 className="font-medium text-sm mb-1">{preset.name}</h4>
                            <p className="text-xs text-muted-foreground mb-2">{preset.description}</p>
                            
                            <div className="flex gap-1 justify-center">
                              {preset.colors.map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-4 h-4 rounded-full border border-border"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="outfit.type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel data-testid="outfit-type-label">Outfit Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="outfit-type-select">
                                  <SelectValue placeholder="Select outfit type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="casual_wear">Casual Wear</SelectItem>
                                <SelectItem value="business_suit">Business Suit</SelectItem>
                                <SelectItem value="evening_wear">Evening Wear</SelectItem>
                                <SelectItem value="fantasy_clothing">Fantasy Clothing</SelectItem>
                                <SelectItem value="futuristic_clothing">Futuristic Clothing</SelectItem>
                                <SelectItem value="vintage_clothing">Vintage Clothing</SelectItem>
                                <SelectItem value="athletic_wear">Athletic Wear</SelectItem>
                                <SelectItem value="traditional_clothing">Traditional Clothing</SelectItem>
                                <SelectItem value="uniform">Uniform</SelectItem>
                                <SelectItem value="cosplay">Cosplay</SelectItem>
                                <SelectItem value="party_outfit">Party Outfit</SelectItem>
                                <SelectItem value="swimwear">Swimwear</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="outfit.style"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel data-testid="outfit-style-label">Style</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="outfit-style-select">
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="modern contemporary">Modern Contemporary</SelectItem>
                                <SelectItem value="professional formal">Professional Formal</SelectItem>
                                <SelectItem value="elegant formal">Elegant Formal</SelectItem>
                                <SelectItem value="medieval fantasy">Medieval Fantasy</SelectItem>
                                <SelectItem value="cyberpunk futuristic">Cyberpunk Futuristic</SelectItem>
                                <SelectItem value="retro vintage">Retro Vintage</SelectItem>
                                <SelectItem value="athletic sporty">Athletic Sporty</SelectItem>
                                <SelectItem value="cultural traditional">Cultural Traditional</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="outfit.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel data-testid="outfit-description-label">
                            Description (Optional)
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the outfit in detail..."
                              className="min-h-[80px]"
                              data-testid="outfit-description-input"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                {/* Color Selection */}
                <div>
                  <Label className="text-sm font-medium mb-3 block" data-testid="color-selection-label">
                    Outfit Colors
                  </Label>
                  <div className="grid grid-cols-8 md:grid-cols-12 gap-2" data-testid="color-palette">
                    {COLOR_PALETTE.map((color) => {
                      const isSelected = selectedColors.includes(color);
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleColorToggle(color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                            isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                          }`}
                          style={{ backgroundColor: color }}
                          data-testid={`color-${color.replace('#', '')}`}
                          title={color}
                        >
                          {isSelected && (
                            <Check className="h-4 w-4 text-white drop-shadow-md" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected colors: {selectedColors.length > 0 ? selectedColors.join(", ") : "None"}
                  </p>
                </div>

                {/* Strength Slider */}
                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="strength-label">
                        Change Strength: {field.value}%
                      </FormLabel>
                      <FormControl>
                        <div className="px-3">
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            data-testid="strength-slider"
                          />
                        </div>
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground px-3">
                        <span>Subtle (1%)</span>
                        <span>Dramatic (100%)</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Preview & Apply */}
            {currentStep === "preview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3" data-testid="preview-title">
                    Preview & Apply Changes
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a preview first, then apply the final changes to your panel.
                  </p>
                </div>

                {/* Job Progress */}
                {currentJob && (
                  <Card data-testid="job-progress-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {currentJob.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {currentJob.status === "completed" && <Check className="h-4 w-4 text-green-500" />}
                        {currentJob.status === "failed" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        <span data-testid="job-status">
                          Job Status: {currentJob.status.charAt(0).toUpperCase() + currentJob.status.slice(1)}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Progress</span>
                            <span data-testid="job-progress-percent">{currentJob.progress}%</span>
                          </div>
                          <Progress value={currentJob.progress} className="w-full" data-testid="job-progress-bar" />
                        </div>

                        {/* Processing Steps */}
                        {currentJob.processingSteps && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Processing Steps:</h4>
                            {currentJob.processingSteps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm" data-testid={`processing-step-${step.step}`}>
                                {step.status === "completed" && <Check className="h-4 w-4 text-green-500" />}
                                {step.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                {step.status === "failed" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                {step.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                                <span className={step.status === "completed" ? "text-green-600" : step.status === "failed" ? "text-red-600" : ""}>
                                  {step.step.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Preview Image */}
                        {currentJob.previewUrl && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Preview Result:</h4>
                            <img
                              src={currentJob.previewUrl}
                              alt="Outfit change preview"
                              className="max-w-full h-auto rounded-lg border"
                              data-testid="preview-image"
                            />
                          </div>
                        )}

                        {/* Error Message */}
                        {currentJob.errorMessage && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-600" data-testid="error-message">{currentJob.errorMessage}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Reset job and allow retry
                                setCurrentJob(null);
                                setPollingJobId(null);
                                setCurrentStep("outfit");
                              }}
                              className="mt-2"
                              data-testid="retry-button"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Try Again
                            </Button>
                          </div>
                        )}

                        {/* Polling Error Message */}
                        {jobError && pollingJobId && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-600">Connection issue while checking job status...</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refetchJobStatus()}
                              className="mt-2"
                              data-testid="retry-polling-button"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handlePreview}
                    disabled={!hasEnoughForPreview || previewMutation.isPending || (currentJob?.status === "processing")}
                    variant="outline"
                    className="flex-1"
                    data-testid="preview-button"
                  >
                    {previewMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview ({previewCost} credit{previewCost !== 1 ? 's' : ''})
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleApply}
                    disabled={!hasEnoughForApply || applyMutation.isPending || (currentJob?.status === "processing") || !currentJob?.previewUrl}
                    className="flex-1"
                    data-testid="apply-button"
                  >
                    {applyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying Changes...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Apply Changes ({applyCost} credit{applyCost !== 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                </div>

                {/* Credit Warnings */}
                {!hasEnoughForPreview && !creditData?.isAdmin && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-600" data-testid="insufficient-credits-preview">
                      Insufficient credits for preview. You need {previewCost} credit{previewCost !== 1 ? 's' : ''} but have {currentCredits}.
                    </p>
                  </div>
                )}

                {!hasEnoughForApply && !creditData?.isAdmin && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-600" data-testid="insufficient-credits-apply">
                      Insufficient credits to apply changes. You need {applyCost} credit{applyCost !== 1 ? 's' : ''} but have {currentCredits}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Form>
        </div>

        <ModalFooterComponent className={`border-t pt-4 ${isMobile ? "sticky bottom-0 bg-background" : ""}`}>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              {currentStep !== "characters" && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  data-testid="prev-step-button"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="cancel-button"
              >
                Cancel
              </Button>

              {currentStep !== "preview" && (
                <Button
                  onClick={handleNextStep}
                  data-testid="next-step-button"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </ModalFooterComponent>
      </ModalContentComponent>
    </ModalContainer>
  );
}