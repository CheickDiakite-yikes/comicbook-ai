import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, AlertTriangle, Clock, Loader2, FileCheck, Users, BookOpen, Settings, CreditCard, Zap } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ValidationResult, ValidationIssue, CharacterConsistencyViolation } from "@shared/schema";

interface ScriptValidationPanelProps {
  projectId: string;
  isOpen?: boolean;
}

interface ValidationReport extends ValidationResult {
  issues: ValidationIssue[];
  characterViolations: CharacterConsistencyViolation[];
}

export default function ScriptValidationPanel({ projectId, isOpen = false }: ScriptValidationPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "character_consistency",
    "story_coherence", 
    "technical_completeness"
  ]);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  // Fetch user credits for validation cost checking
  const { data: userCredits, isLoading: creditsLoading } = useQuery({
    queryKey: ["/api/credits"],
    enabled: isOpen,
    refetchInterval: 30000, // Refresh credits every 30 seconds
  });

  // Fetch validation reports with improved error handling
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery<ValidationResult[]>({
    queryKey: ["/api/projects", projectId, "validation-reports"],
    enabled: isOpen,
    retry: (failureCount, error: any) => {
      // Don't retry on 403/404 errors
      if (error?.status === 403 || error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  // Get latest report details with enhanced error handling
  const latestReport = reports[0];
  const { data: reportDetails, isLoading: reportDetailsLoading, error: reportDetailsError } = useQuery<ValidationReport>({
    queryKey: ["/api/validation-reports", latestReport?.id],
    enabled: !!latestReport?.id,
    retry: (failureCount, error: any) => {
      if (error?.status === 403 || error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  // Enhanced validation mutation with credit error handling
  const validateScript = useMutation({
    mutationFn: async (validationCategories: string[]) => {
      return await apiRequest(
        "POST",
        `/api/projects/${projectId}/validate`,
        {
          validationCategories,
          validationType: "comprehensive"
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "✅ Validation Complete",
        description: "Script validation has been completed successfully.",
      });
      // Invalidate both validation reports and credits
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "validation-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    },
    onError: (error: any) => {
      console.error("Validation error:", error);
      
      // Handle specific error types
      if (error?.status === 402) {
        // Credit insufficient error
        const remainingCredits = error?.remainingCredits || 0;
        const requiredCredits = error?.creditsRequired || 25;
        
        toast({
          title: "💳 Insufficient Credits",
          description: `You need ${requiredCredits} credits but only have ${remainingCredits} remaining. Upgrade your plan to continue validation.`,
          variant: "destructive",
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/pricing', '_blank')}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Upgrade
            </Button>
          ),
        });
      } else if (error?.status === 403) {
        toast({
          title: "❌ Access Denied",
          description: "You don't have permission to validate this project.",
          variant: "destructive",
        });
      } else if (error?.status === 404) {
        toast({
          title: "❌ Project Not Found",
          description: "The project you're trying to validate was not found.",
          variant: "destructive",
        });
      } else if (error?.status >= 500) {
        toast({
          title: "🔧 Server Error",
          description: "Our validation service is temporarily unavailable. Please try again in a few minutes.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Validation Failed",
          description: error?.message || "An unexpected error occurred during validation. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const runValidation = () => {
    if (selectedCategories.length === 0) {
      toast({
        title: "No Categories Selected",
        description: "Please select at least one validation category.",
        variant: "destructive",
      });
      return;
    }
    validateScript.mutate(selectedCategories);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getOverallScore = () => {
    if (!reportDetails) return 0;
    return Math.round(
      ((reportDetails.characterConsistencyScore || 0) +
       (reportDetails.storyCoherenceScore || 0) +
       (reportDetails.technicalCompletenessScore || 0)) / 3
    );
  };

  if (!isOpen) return null;

  return (
    <Card className="w-full h-full" data-testid="validation-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Script Quality Validation
        </CardTitle>
        <CardDescription>
          Ensure character consistency, story coherence, and technical completeness
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4 px-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="character" data-testid="tab-character">Characters</TabsTrigger>
            <TabsTrigger value="story" data-testid="tab-story">Story</TabsTrigger>
            <TabsTrigger value="technical" data-testid="tab-technical">Technical</TabsTrigger>
          </TabsList>

          <div className="px-6 pb-6">
            <TabsContent value="overview" className="mt-6">
              <div className="space-y-6">
                {/* Validation Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Run New Validation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="character_consistency"
                        checked={selectedCategories.includes("character_consistency")}
                        onCheckedChange={() => handleCategoryToggle("character_consistency")}
                        data-testid="checkbox-character-consistency"
                      />
                      <label htmlFor="character_consistency" className="text-sm font-medium leading-none">
                        Character Consistency
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="story_coherence"
                        checked={selectedCategories.includes("story_coherence")}
                        onCheckedChange={() => handleCategoryToggle("story_coherence")}
                        data-testid="checkbox-story-coherence"
                      />
                      <label htmlFor="story_coherence" className="text-sm font-medium leading-none">
                        Story Coherence
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="technical_completeness"
                        checked={selectedCategories.includes("technical_completeness")}
                        onCheckedChange={() => handleCategoryToggle("technical_completeness")}
                        data-testid="checkbox-technical-completeness"
                      />
                      <label htmlFor="technical_completeness" className="text-sm font-medium leading-none">
                        Technical Completeness
                      </label>
                    </div>
                  </div>
                  <Button
                    onClick={runValidation}
                    disabled={validateScript.isPending || selectedCategories.length === 0}
                    className="w-full md:w-auto"
                    data-testid="button-run-validation"
                  >
                    {validateScript.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <FileCheck className="h-4 w-4 mr-2" />
                        Run Validation (2 credits)
                      </>
                    )}
                  </Button>
                </div>

                <Separator />

                {/* Latest Report Overview */}
                {reportDetails ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Latest Validation Report</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Overall Score</span>
                            <Badge variant="outline" data-testid="overall-score">
                              {getOverallScore()}%
                            </Badge>
                          </div>
                          <Progress value={getOverallScore()} className="mt-2" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-medium">Characters</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-bold" data-testid="character-score">
                              {reportDetails.characterConsistencyScore || 0}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <BookOpen className="h-4 w-4" />
                            <span className="text-sm font-medium">Story</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-bold" data-testid="story-score">
                              {reportDetails.storyCoherenceScore || 0}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Settings className="h-4 w-4" />
                            <span className="text-sm font-medium">Technical</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-bold" data-testid="technical-score">
                              {reportDetails.technicalCompletenessScore || 0}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Issues Summary */}
                    {reportDetails.issues && reportDetails.issues.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Issues Found</h4>
                        <ScrollArea className="h-48 w-full rounded-md border p-4">
                          <div className="space-y-2">
                            {reportDetails.issues.map((issue) => (
                              <Alert key={issue.id} className="p-3" data-testid={`issue-${issue.id}`}>
                                <div className="flex items-start gap-2">
                                  {getSeverityIcon(issue.severity)}
                                  <div className="flex-1">
                                    <AlertTitle className="text-sm font-medium">
                                      {issue.title}
                                    </AlertTitle>
                                    <AlertDescription className="text-sm text-muted-foreground">
                                      {issue.description}
                                    </AlertDescription>
                                    {issue.suggestion && (
                                      <div className="mt-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                        <strong>Suggestion:</strong> {issue.suggestion}
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant={getSeverityColor(issue.severity) as any}>
                                    {issue.severity}
                                  </Badge>
                                </div>
                              </Alert>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : reportsLoading || reportDetailsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading validation reports...</span>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No validation reports yet. Run your first validation above.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="character" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Character Consistency Analysis</h3>
                {reportDetails?.characterViolations && reportDetails.characterViolations.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {reportDetails.characterViolations.map((violation) => (
                      <AccordionItem key={violation.id} value={violation.id}>
                        <AccordionTrigger data-testid={`character-violation-${violation.id}`}>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(violation.severity)}
                            <span>{violation.characterName} - {violation.violationType}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">{violation.description}</p>
                            <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                              <strong>Page:</strong> {violation.pageNumber} | <strong>Panel:</strong> {violation.panelNumber}
                            </div>
                            {violation.expectedValue && (
                              <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                <strong>Expected:</strong> {violation.expectedValue}
                              </div>
                            )}
                            {violation.actualValue && (
                              <div className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                <strong>Found:</strong> {violation.actualValue}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No character consistency issues found.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Story Coherence Analysis</h3>
                {reportDetails?.issues?.filter(issue => issue.category === 'story_coherence').length ? (
                  <div className="space-y-2">
                    {reportDetails.issues
                      .filter(issue => issue.category === 'story_coherence')
                      .map((issue) => (
                        <Alert key={issue.id} data-testid={`story-issue-${issue.id}`}>
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <AlertTitle>{issue.title}</AlertTitle>
                              <AlertDescription>{issue.description}</AlertDescription>
                              {issue.suggestion && (
                                <div className="mt-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                  <strong>Suggestion:</strong> {issue.suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                        </Alert>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No story coherence issues found.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="technical" className="mt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Technical Completeness Analysis</h3>
                {reportDetails?.issues?.filter(issue => issue.category === 'technical_completeness').length ? (
                  <div className="space-y-2">
                    {reportDetails.issues
                      .filter(issue => issue.category === 'technical_completeness')
                      .map((issue) => (
                        <Alert key={issue.id} data-testid={`technical-issue-${issue.id}`}>
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <AlertTitle>{issue.title}</AlertTitle>
                              <AlertDescription>{issue.description}</AlertDescription>
                              {issue.suggestion && (
                                <div className="mt-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                  <strong>Suggestion:</strong> {issue.suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                        </Alert>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No technical completeness issues found.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}