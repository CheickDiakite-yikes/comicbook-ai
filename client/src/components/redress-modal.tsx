import { useState, useEffect } from "react";
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
  const [currentStep, setCurrentStep] = useState<"characters" | "outfit" | "preview">("characters");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [currentJob, setCurrentJob] = useState<RedressJob | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

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
      if (data?.state === "error" || data?.status === "completed" || data?.status === "failed") {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" data-testid="redress-modal">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2" data-testid="modal-title">
                <Shirt className="h-5 w-5" />
                Change Character Outfits
              </DialogTitle>
              <DialogDescription data-testid="modal-description">
                Select characters and customize their clothing using AI-powered outfit generation
              </DialogDescription>
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
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Form {...form}>
            {/* Step 1: Character Selection */}
            {currentStep === "characters" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3" data-testid="character-selection-title">
                    Select Characters to Redress
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose which characters in this panel should have their outfits changed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="character-grid">
                  {characters.map((character) => {
                    const isSelected = form.getValues("characters").some(c => c.characterId === character.id);
                    
                    return (
                      <Card
                        key={character.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handleCharacterToggle(character)}
                        data-testid={`character-card-${character.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={character.referenceImageUrl || undefined} />
                                <AvatarFallback>
                                  <User className="h-6 w-6" />
                                </AvatarFallback>
                              </Avatar>
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate" data-testid={`character-name-${character.id}`}>
                                {character.name}
                              </h4>
                              {character.role && (
                                <p className="text-xs text-muted-foreground capitalize">
                                  {character.role}
                                </p>
                              )}
                              
                              {/* Current Outfit Info */}
                              {character.currentOutfit && (
                                <div className="mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    Current Outfit
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {typeof character.currentOutfit === 'string' 
                                      ? character.currentOutfit 
                                      : 'Custom outfit'}
                                  </p>
                                </div>
                              )}
                            </div>

                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleCharacterToggle(character)}
                              className="pointer-events-none"
                              data-testid={`character-checkbox-${character.id}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {characters.length === 0 && (
                  <Card className="p-8 text-center">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="font-medium text-muted-foreground mb-2">No Characters Found</h4>
                    <p className="text-sm text-muted-foreground">
                      No characters are available for this panel. Add characters to your project first.
                    </p>
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

        <DialogFooter className="border-t pt-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}