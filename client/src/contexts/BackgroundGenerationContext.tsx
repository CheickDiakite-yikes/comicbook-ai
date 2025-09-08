import { createContext, useContext, useState, ReactNode } from 'react';

export interface GeneratedStoryData {
  genres: string[];
  length: string;
  artStyle: string;
  tones: string[];
}

export interface GeneratedStoryResult {
  title: string;
  genre: string;
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
      { step: 'Writing Script', description: 'Generating complete structured script', completed: false },
      { step: 'Finalizing Details', description: 'Polishing and optimizing content', completed: false }
    ];

    setState({
      ...initialState,
      status: 'generating',
      storyData,
      steps,
      startedAt: new Date(),
      currentStep: steps[0].step,
      progress: 0
    });

    try {
      // Simulate progressive steps for better UX
      for (let i = 0; i < steps.length; i++) {
        setState(prev => ({
          ...prev,
          currentStep: steps[i].step,
          progress: ((i + 1) / steps.length) * 90, // 90% for generation, 10% for finalization
        }));

        // Add realistic delays between steps
        if (i < steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        }

        setState(prev => ({
          ...prev,
          steps: prev.steps.map((step, index) => 
            index === i ? { ...step, completed: true } : step
          )
        }));
      }

      // Actual API call
      const response = await fetch("/api/generate-complete-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genres: storyData.genres,
          length: storyData.length,
          artStyle: storyData.artStyle,
          tones: storyData.tones
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate complete story");
      }

      const generatedResult = await response.json();

      setState(prev => ({
        ...prev,
        status: 'completed',
        generatedResult,
        progress: 100,
        currentStep: 'Generation Complete!',
        completedAt: new Date(),
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