import { createContext, useContext, useState, ReactNode } from 'react';

export interface GeneratedStoryData {
  genres: string[];
  length: string;
  artStyle: string;
  tones: string[];
}

export interface GeneratedStoryResult {
  title: string;
  genre: string; // AI-enhanced detailed genre description
  userSelectedGenres?: string[]; // Simple user-selected genres for UI display
  description: string;
  characters: Array<{
    name: string;
    role: string;
    bio: string;
    visualDescriptors: string;
  }>;
  structuredScript: any;
}

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

interface GenerationStep {
  step: string;
  description: string;
  completed: boolean;
}

interface BackgroundGenerationState {
  status: GenerationStatus;
  storyData: GeneratedStoryData | null;
  generatedResult: GeneratedStoryResult | null;
  error: string | null;
  progress: number;
  currentStep: string;
  steps: GenerationStep[];
  startedAt: Date | null;
  completedAt: Date | null;
}

interface BackgroundGenerationContextType {
  state: BackgroundGenerationState;
  startGeneration: (storyData: GeneratedStoryData) => Promise<void>;
  clearGeneration: () => void;
  dismissError: () => void;
  markStepCompleted: (stepIndex: number) => void;
}

const initialState: BackgroundGenerationState = {
  status: 'idle',
  storyData: null,
  generatedResult: null,
  error: null,
  progress: 0,
  currentStep: '',
  steps: [],
  startedAt: null,
  completedAt: null,
};

const BackgroundGenerationContext = createContext<BackgroundGenerationContextType | undefined>(undefined);

export function BackgroundGenerationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackgroundGenerationState>(initialState);

  const startGeneration = async (storyData: GeneratedStoryData) => {
    const steps: GenerationStep[] = [
      { step: 'Analyzing Story Requirements', description: 'Processing your creative preferences', completed: false },
      { step: 'Crafting Story Concept', description: 'Generating title and plot outline', completed: false },
      { step: 'Building Characters', description: 'Creating detailed character profiles', completed: false },
      { step: 'Parallel Script Generation', description: 'Using AI parallel processing for faster generation', completed: false },
      { step: 'Finalizing Epic Story', description: 'Combining and optimizing all story elements', completed: false }
    ];

    setState({
      ...initialState,
      status: 'generating',
      storyData,
      steps,
      startedAt: new Date(),
      currentStep: steps[0].step,
      progress: 10
    });

    // Helper function for API call with retry logic
    const makeApiCall = async (retryCount = 0): Promise<any> => {
      const maxRetries = 2;
      
      try {
        // Set current step and progress
        setState(prev => ({
          ...prev,
          currentStep: 'Generating AI Story...',
          progress: 20
        }));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

        const response = await fetch("/api/generate-complete-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            genres: storyData.genres,
            length: storyData.length,
            artStyle: storyData.artStyle,
            tones: storyData.tones
          }),
        });

        clearTimeout(timeoutId);

        // Handle 401 Unauthorized errors with retry
        if (response.status === 401 && retryCount < maxRetries) {
          console.log(`Authentication failed, retrying... (${retryCount + 1}/${maxRetries})`);
          setState(prev => ({
            ...prev,
            currentStep: 'Retrying authentication...',
            progress: 15
          }));
          
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return makeApiCall(retryCount + 1);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to generate story: ${response.status} - ${errorText}`);
        }

        return await response.json();

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error("Request timed out after 5 minutes");
        }
        
        // Retry on network errors
        if (retryCount < maxRetries && error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
          console.log(`Network error, retrying... (${retryCount + 1}/${maxRetries})`);
          setState(prev => ({
            ...prev,
            currentStep: 'Retrying connection...',
            progress: 15
          }));
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          return makeApiCall(retryCount + 1);
        }
        
        throw error;
      }
    };

    try {
      // Progressive step simulation while API call is in progress
      const progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.status !== 'generating' || prev.progress >= 95) {
            return prev;
          }
          
          const nextProgress = Math.min(prev.progress + 5, 95);
          const currentStepIndex = Math.floor((nextProgress / 95) * steps.length);
          const currentStep = steps[currentStepIndex] || steps[steps.length - 1];
          
          return {
            ...prev,
            progress: nextProgress,
            currentStep: currentStep.step,
            steps: prev.steps.map((step, index) => 
              index < currentStepIndex ? { ...step, completed: true } : step
            )
          };
        });
      }, 2000); // Update every 2 seconds for smooth progress

      // Make the actual API call immediately
      const generatedResult = await makeApiCall();

      // Clear the progress interval
      clearInterval(progressInterval);

      // Complete all steps
      setState(prev => ({
        ...prev,
        status: 'completed',
        generatedResult,
        progress: 100,
        currentStep: 'Generation Complete!',
        completedAt: new Date(),
        steps: prev.steps.map(step => ({ ...step, completed: true }))
      }));

    } catch (error) {
      console.error("Error generating AI story:", error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : "Unknown error occurred",
        progress: 0,
        currentStep: 'Generation Failed',
      }));
    }
  };

  const clearGeneration = () => {
    setState(initialState);
  };

  const dismissError = () => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
  };

  const markStepCompleted = (stepIndex: number) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map((step, index) => 
        index === stepIndex ? { ...step, completed: true } : step
      )
    }));
  };

  return (
    <BackgroundGenerationContext.Provider value={{
      state,
      startGeneration,
      clearGeneration,
      dismissError,
      markStepCompleted,
    }}>
      {children}
    </BackgroundGenerationContext.Provider>
  );
}

export function useBackgroundGeneration() {
  const context = useContext(BackgroundGenerationContext);
  if (context === undefined) {
    throw new Error('useBackgroundGeneration must be used within a BackgroundGenerationProvider');
  }
  return context;
}