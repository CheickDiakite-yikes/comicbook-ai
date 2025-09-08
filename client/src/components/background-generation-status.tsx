import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useBackgroundGeneration } from "@/contexts/BackgroundGenerationContext";
import { 
  X, 
  Wand2, 
  CheckCircle, 
  XCircle, 
  Sparkles,
  FileText,
  Users,
  Lightbulb,
  BookOpen,
  Maximize2,
  Minimize2
} from "lucide-react";

export default function BackgroundGenerationStatus() {
  const { state, clearGeneration, dismissError } = useBackgroundGeneration();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no generation is happening
  if (state.status === 'idle') return null;

  const handleDismiss = () => {
    if (state.status === 'generating') {
      toast({
        title: "Generation continues in background",
        description: "Your story will be ready soon. We'll notify you when it's complete!",
      });
    }
    clearGeneration();
  };

  const handleReturnToProject = () => {
    // This will be implemented to reopen the create project modal with generated data
    toast({
      title: "Opening Project Creation",
      description: "Your generated story will be pre-filled in the form!",
    });
    clearGeneration();
    // TODO: Trigger modal open with pre-filled data
  };

  const getStatusIcon = () => {
    switch (state.status) {
      case 'generating':
        return <Wand2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'generating':
        return 'Generating Story...';
      case 'completed':
        return 'Story Ready!';
      case 'error':
        return 'Generation Failed';
      default:
        return '';
    }
  };

  const getElapsedTime = () => {
    if (!state.startedAt) return '';
    const now = state.completedAt || new Date();
    const elapsed = Math.floor((now.getTime() - state.startedAt.getTime()) / 1000);
    return `${elapsed}s`;
  };

  const getStepIcon = (step: string) => {
    if (step.includes('Requirements')) return <Lightbulb className="h-3 w-3" />;
    if (step.includes('Concept')) return <Sparkles className="h-3 w-3" />;
    if (step.includes('Characters')) return <Users className="h-3 w-3" />;
    if (step.includes('Script')) return <FileText className="h-3 w-3" />;
    if (step.includes('Details')) return <BookOpen className="h-3 w-3" />;
    return <Sparkles className="h-3 w-3" />;
  };

  if (!isExpanded) {
    // Compact floating indicator
    return (
      <div className="fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out">
        <Card className="shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{getStatusText()}</p>
                {state.status === 'generating' && (
                  <p className="text-xs text-muted-foreground">{state.currentStep}</p>
                )}
                {state.status === 'completed' && state.generatedResult && (
                  <p className="text-xs text-muted-foreground">"{state.generatedResult.title}"</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {state.status === 'generating' && (
                  <div className="w-12">
                    <Progress value={state.progress} className="h-1" />
                  </div>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className="h-6 w-6 p-0"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expanded detailed view
  return (
    <div className="fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out">
      <Card className="shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm w-80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle className="text-base">{getStatusText()}</CardTitle>
              {state.status === 'generating' && getElapsedTime() && (
                <Badge variant="secondary" className="text-xs">{getElapsedTime()}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {state.status === 'generating' && (
            <div className="space-y-2">
              <Progress value={state.progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(state.progress)}% complete
              </p>
            </div>
          )}

          {/* Story Details */}
          {state.storyData && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Story Configuration:</p>
              <div className="flex flex-wrap gap-1">
                {state.storyData.genres.map(genre => (
                  <Badge key={genre} variant="outline" className="text-xs">{genre}</Badge>
                ))}
                <Badge variant="outline" className="text-xs">{state.storyData.length}</Badge>
                <Badge variant="outline" className="text-xs">{state.storyData.artStyle}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {state.storyData.tones.map(tone => (
                  <Badge key={tone} variant="secondary" className="text-xs">{tone}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Generation Steps */}
          {state.status === 'generating' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Progress:</p>
              <div className="space-y-1">
                {state.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border ${
                      step.completed 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : state.currentStep === step.step
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    }`}>
                      {step.completed ? (
                        <CheckCircle className="h-2 w-2" />
                      ) : (
                        getStepIcon(step.step)
                      )}
                    </div>
                    <span className={step.completed ? 'text-muted-foreground line-through' : ''}>
                      {step.step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {state.status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{state.error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={dismissError}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Completion State */}
          {state.status === 'completed' && state.generatedResult && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">"{state.generatedResult.title}"</p>
                <p className="text-xs text-muted-foreground">
                  Generated {state.generatedResult.characters?.length || 0} characters and complete script
                </p>
              </div>
              <Button
                onClick={handleReturnToProject}
                className="w-full bg-gradient-to-r from-primary to-accent"
                size="sm"
              >
                <Sparkles className="mr-2 h-3 w-3" />
                Create Project with This Story
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}