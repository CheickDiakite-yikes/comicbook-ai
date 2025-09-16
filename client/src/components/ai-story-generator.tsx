import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useBackgroundGeneration } from "@/contexts/BackgroundGenerationContext";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Wand2, 
  Sparkles,
  X,
  Clock,
  Palette,
  Heart,
  Sword,
  Zap,
  Smile,
  Skull
} from "lucide-react";

interface AIStoryGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedStoryData {
  genres: string[];
  length: string;
  artStyle: string;
  tones: string[];
}

const genres = [
  { id: "action", name: "Action", icon: "⚡", color: "from-red-500 to-orange-500" },
  { id: "adventure", name: "Adventure", icon: "🗺️", color: "from-green-500 to-teal-500" },
  { id: "anime", name: "Anime", icon: "🎌", color: "from-pink-400 to-purple-500" },
  { id: "betrayal", name: "Betrayal", icon: "🗡️", color: "from-red-700 to-gray-800" },
  { id: "business", name: "Business", icon: "💼", color: "from-gray-600 to-blue-600" },
  { id: "child-learning", name: "Child Learning", icon: "📚", color: "from-green-400 to-yellow-400" },
  { id: "comedy", name: "Comedy", icon: "😄", color: "from-yellow-500 to-orange-400" },
  { id: "coming-to-life", name: "Coming to Life", icon: "✨", color: "from-purple-400 to-pink-500" },
  { id: "drama", name: "Drama", icon: "🎭", color: "from-purple-600 to-red-600" },
  { id: "erotic", name: "Erotic", icon: "🔥", color: "from-red-600 to-pink-600" },
  { id: "fantasy", name: "Fantasy", icon: "🧙", color: "from-purple-500 to-indigo-500" },
  { id: "horror", name: "Horror", icon: "👻", color: "from-gray-800 to-black" },
  { id: "mystery", name: "Mystery", icon: "🔍", color: "from-indigo-600 to-purple-600" },
  { id: "non-fiction", name: "Non-Fiction", icon: "📖", color: "from-blue-600 to-gray-600" },
  { id: "raunchy", name: "Raunchy", icon: "😈", color: "from-red-500 to-purple-600" },
  { id: "romance", name: "Romance", icon: "💕", color: "from-pink-500 to-rose-500" },
  { id: "sci-fi", name: "Sci-Fi", icon: "🚀", color: "from-blue-500 to-cyan-500" },
  { id: "sexy", name: "Sexy", icon: "💋", color: "from-pink-600 to-red-500" },
  { id: "shooter", name: "Shooter", icon: "🎯", color: "from-orange-600 to-red-700" },
  { id: "slice-of-life", name: "Slice of Life", icon: "🌸", color: "from-green-400 to-blue-400" },
  { id: "spicy", name: "Spicy", icon: "🌶️", color: "from-red-500 to-orange-600" },
  { id: "superhero", name: "Superhero", icon: "🦸", color: "from-blue-600 to-red-600" },
  { id: "thriller", name: "Thriller", icon: "⚡", color: "from-red-600 to-black" },
  { id: "who-done-it", name: "Who Done It", icon: "🕵️", color: "from-gray-700 to-indigo-700" }
];

const storyLengths = [
  { id: "short", name: "Short Story", pages: "6-12 pages", description: "Perfect for quick reads and focused concepts", icon: <Clock className="h-5 w-5" /> },
  { id: "medium", name: "Medium Story", pages: "12-20 pages", description: "Great for character development and complex plots", icon: <Heart className="h-5 w-5" /> },
  { id: "epic", name: "Epic Story", pages: "20-30+ pages", description: "Ideal for world-building and grand adventures", icon: <Sword className="h-5 w-5" /> }
];

const artStyles = [
  { id: "comic-book", name: "Comic Book", icon: "🦸", description: "Classic superhero style" },
  { id: "manga", name: "Manga", icon: "🏯", description: "Japanese comic style" },
  { id: "watercolor", name: "Watercolor", icon: "🎨", description: "Soft, artistic look" },
  { id: "sketch", name: "Sketch", icon: "✏️", description: "Hand-drawn aesthetic" },
  { id: "realistic", name: "Realistic", icon: "📸", description: "Photorealistic imagery" },
  { id: "cartoon", name: "Cartoon", icon: "🎪", description: "Animated cartoon style" },
  { id: "pixar-like", name: "Pixar Like", icon: "🎬", description: "3D animated movie style" },
  { id: "ghibli-like", name: "Ghibli Like", icon: "🌸", description: "Studio Ghibli animation style" },
  { id: "erotica", name: "Erotica", icon: "🔞", description: "Mature artistic style" }
];

const tones = [
  { id: "heroic", name: "Heroic", icon: "🦸", color: "from-yellow-400 to-orange-500" },
  { id: "dark", name: "Dark", icon: "🌑", color: "from-gray-700 to-black" },
  { id: "lighthearted", name: "Lighthearted", icon: "☀️", color: "from-green-400 to-blue-500" },
  { id: "mysterious", name: "Mysterious", icon: "🔮", color: "from-indigo-600 to-purple-700" },
  { id: "funny", name: "Funny", icon: "😂", color: "from-yellow-500 to-pink-500" },
  { id: "dramatic", name: "Dramatic", icon: "🎭", color: "from-red-600 to-purple-600" },
  { id: "touching", name: "Touching", icon: "💝", color: "from-pink-500 to-rose-500" },
  { id: "sad", name: "Sad", icon: "😢", color: "from-blue-600 to-gray-600" },
  { id: "epic", name: "Epic", icon: "⚔️", color: "from-orange-500 to-red-600" },
  { id: "romantic", name: "Romantic", icon: "💕", color: "from-pink-400 to-red-500" },
  { id: "suspenseful", name: "Suspenseful", icon: "😰", color: "from-purple-600 to-black" },
  { id: "adventurous", name: "Adventurous", icon: "🗺️", color: "from-green-500 to-teal-500" },
  { id: "whimsical", name: "Whimsical", icon: "🌈", color: "from-purple-400 to-pink-400" },
  { id: "gritty", name: "Gritty", icon: "🔧", color: "from-gray-600 to-red-800" },
  { id: "nostalgic", name: "Nostalgic", icon: "📸", color: "from-amber-400 to-orange-600" },
  { id: "intense", name: "Intense", icon: "🔥", color: "from-red-500 to-orange-700" },
  { id: "peaceful", name: "Peaceful", icon: "🕊️", color: "from-blue-400 to-green-400" },
  { id: "chaotic", name: "Chaotic", icon: "💥", color: "from-red-600 to-yellow-500" },
  { id: "inspiring", name: "Inspiring", icon: "✨", color: "from-cyan-400 to-blue-500" },
  { id: "melancholy", name: "Melancholy", icon: "🍂", color: "from-gray-500 to-blue-700" },
  { id: "sexy", name: "Sexy", icon: "💋", color: "from-pink-600 to-red-500" },
  { id: "raunchy", name: "Raunchy", icon: "😈", color: "from-red-500 to-purple-600" },
  { id: "erotic", name: "Erotic", icon: "🔥", color: "from-red-600 to-pink-600" },
  { id: "depressing", name: "Depressing", icon: "😞", color: "from-gray-700 to-slate-900" },
  { id: "emotional", name: "Emotional", icon: "💗", color: "from-pink-500 to-purple-500" },
  { id: "scary", name: "Scary", icon: "😱", color: "from-gray-800 to-black" },
  { id: "happy", name: "Happy", icon: "😊", color: "from-yellow-400 to-orange-400" }
];

export default function AIStoryGenerator({ isOpen, onClose }: AIStoryGeneratorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLength, setSelectedLength] = useState<string>("");
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("");
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  
  const { startGeneration, state } = useBackgroundGeneration();
  const { toast } = useToast();
  
  const isGenerating = state.status === 'generating';

  if (!isOpen) return null;

  const progress = (currentStep / 4) * 100;

  const toggleGenre = (genreId: string) => {
    if (selectedGenres.includes(genreId)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genreId));
    } else if (selectedGenres.length < 4) {
      setSelectedGenres([...selectedGenres, genreId]);
    }
  };

  const toggleTone = (toneId: string) => {
    if (selectedTones.includes(toneId)) {
      setSelectedTones(selectedTones.filter(t => t !== toneId));
    } else if (selectedTones.length < 3) {
      setSelectedTones([...selectedTones, toneId]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedGenres.length > 0;
      case 2: return selectedLength !== "";
      case 3: return selectedArtStyle !== "";
      case 4: return selectedTones.length > 0;
      default: return false;
    }
  };

  const handleGenerate = async () => {
    const storyData: GeneratedStoryData = {
      genres: selectedGenres,
      length: selectedLength,
      artStyle: selectedArtStyle,
      tones: selectedTones
    };
    
    // Start background generation
    await startGeneration(storyData);
    
    // Show helpful message and close modal
    toast({
      title: "🎨 Story Generation Started!",
      description: "Your story is being crafted in the background. You can continue using the app - we'll notify you when it's ready!",
      duration: 5000,
    });
    
    // Close modal immediately - generation continues in background
    onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">Choose Your Genres</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Select up to 4 genres to blend unique story elements</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 sm:gap-3">
              {genres.map((genre) => (
                <Card 
                  key={genre.id}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedGenres.includes(genre.id) 
                      ? "border-primary bg-primary/10 shadow-lg" 
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => toggleGenre(genre.id)}
                >
                  <CardContent className="p-2 sm:p-4 text-center">
                    <div className={`text-xl sm:text-2xl lg:text-3xl mb-1 sm:mb-2 bg-gradient-to-r ${genre.color} bg-clip-text text-transparent`}>
                      {genre.icon}
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base font-medium">{genre.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedGenres.length > 0 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Selected: </p>
                <div className="flex justify-center gap-2 mt-2">
                  {selectedGenres.map(genreId => {
                    const genre = genres.find(g => g.id === genreId);
                    return (
                      <Badge key={genreId} variant="secondary">
                        {genre?.icon} {genre?.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">Story Length</h3>
              <p className="text-sm sm:text-base text-muted-foreground">How much story do you want to tell?</p>
            </div>
            <div className="space-y-4">
              {storyLengths.map((length) => (
                <Card 
                  key={length.id}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedLength === length.id 
                      ? "border-primary bg-primary/10 shadow-lg" 
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => setSelectedLength(length.id)}
                >
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="text-primary flex-shrink-0">{length.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base lg:text-lg">{length.name}</h4>
                        <p className="text-primary font-medium text-sm sm:text-base">{length.pages}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{length.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">Art Style</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Choose the visual style for your comic</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {artStyles.map((style) => (
                <Card 
                  key={style.id}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedArtStyle === style.id 
                      ? "border-primary bg-primary/10 shadow-lg" 
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => setSelectedArtStyle(style.id)}
                >
                  <CardContent className="p-3 sm:p-6 text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-3">{style.icon}</div>
                    <h4 className="font-semibold text-sm sm:text-base">{style.name}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{style.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">Story Tone</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Select up to 3 tones to blend emotional depth</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {tones.map((tone) => (
                <Card 
                  key={tone.id}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedTones.includes(tone.id) 
                      ? "border-primary bg-primary/10 shadow-lg" 
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => toggleTone(tone.id)}
                >
                  <CardContent className="p-2 sm:p-3 text-center">
                    <div className={`text-lg sm:text-xl lg:text-2xl mb-1 sm:mb-2 bg-gradient-to-r ${tone.color} bg-clip-text text-transparent`}>
                      {tone.icon}
                    </div>
                    <p className="text-xs sm:text-sm font-medium">{tone.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedTones.length > 0 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Selected tones: </p>
                <div className="flex justify-center gap-2 mt-2 flex-wrap">
                  {selectedTones.map(toneId => {
                    const tone = tones.find(t => t.id === toneId);
                    return (
                      <Badge key={toneId} variant="secondary" className="text-sm">
                        {tone?.icon} {tone?.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop (but not when clicking inside modal)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-sm sm:max-w-lg lg:max-w-2xl max-h-[95vh] shadow-2xl overflow-hidden">
        <CardHeader className="text-center border-b px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Story Generator
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Step {currentStep} of 4
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="mt-3 sm:mt-4" />
        </CardHeader>
        
        <CardContent className="p-3 sm:p-6 lg:p-8 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
          {renderStep()}
        </CardContent>

        <div className="flex items-center justify-between p-3 sm:p-6 border-t">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="text-xs sm:text-sm"
          >
            <ChevronLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </Button>
          
          {currentStep < 4 ? (
            <Button 
              size="sm"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          ) : (
            <Button 
              size="sm"
              onClick={handleGenerate}
              disabled={!canProceed() || isGenerating}
              className="bg-gradient-to-r from-primary to-accent text-xs sm:text-sm"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">Generating Story...</span>
                  <span className="sm:hidden">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Generate My Story!</span>
                  <span className="sm:hidden">Generate!</span>
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}