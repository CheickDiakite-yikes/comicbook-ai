import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  onGenerate: (storyData: GeneratedStoryData) => void;
}

interface GeneratedStoryData {
  genres: string[];
  length: string;
  artStyle: string;
  tone: string;
}

const genres = [
  { id: "action", name: "Action", icon: "⚡", color: "from-red-500 to-orange-500" },
  { id: "romance", name: "Romance", icon: "💕", color: "from-pink-500 to-rose-500" },
  { id: "sci-fi", name: "Sci-Fi", icon: "🚀", color: "from-blue-500 to-cyan-500" },
  { id: "fantasy", name: "Fantasy", icon: "🧙", color: "from-purple-500 to-indigo-500" },
  { id: "horror", name: "Horror", icon: "👻", color: "from-gray-800 to-black" },
  { id: "comedy", name: "Comedy", icon: "😄", color: "from-yellow-500 to-orange-400" },
  { id: "mystery", name: "Mystery", icon: "🔍", color: "from-indigo-600 to-purple-600" },
  { id: "superhero", name: "Superhero", icon: "🦸", color: "from-blue-600 to-red-600" },
  { id: "slice-of-life", name: "Slice of Life", icon: "🌸", color: "from-green-400 to-blue-400" },
  { id: "thriller", name: "Thriller", icon: "⚡", color: "from-red-600 to-black" }
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
  { id: "sketch", name: "Sketch", icon: "✏️", description: "Hand-drawn aesthetic" }
];

const tones = [
  { id: "heroic", name: "Heroic", description: "Inspiring and uplifting", icon: <Sparkles className="h-5 w-5" />, color: "from-yellow-400 to-orange-500" },
  { id: "dark", name: "Dark", description: "Serious and intense", icon: <Skull className="h-5 w-5" />, color: "from-gray-700 to-black" },
  { id: "lighthearted", name: "Lighthearted", description: "Fun and optimistic", icon: <Smile className="h-5 w-5" />, color: "from-green-400 to-blue-500" },
  { id: "mysterious", name: "Mysterious", description: "Intriguing and suspenseful", icon: <Zap className="h-5 w-5" />, color: "from-indigo-600 to-purple-700" }
];

export default function AIStoryGenerator({ isOpen, onClose, onGenerate }: AIStoryGeneratorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLength, setSelectedLength] = useState<string>("");
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const progress = (currentStep / 4) * 100;

  const toggleGenre = (genreId: string) => {
    if (selectedGenres.includes(genreId)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genreId));
    } else if (selectedGenres.length < 2) {
      setSelectedGenres([...selectedGenres, genreId]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedGenres.length > 0;
      case 2: return selectedLength !== "";
      case 3: return selectedArtStyle !== "";
      case 4: return selectedTone !== "";
      default: return false;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const storyData: GeneratedStoryData = {
      genres: selectedGenres,
      length: selectedLength,
      artStyle: selectedArtStyle,
      tone: selectedTone
    };
    
    onGenerate(storyData);
    setIsGenerating(false);
    onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Choose Your Genres</h3>
              <p className="text-muted-foreground">Select up to 2 genres to blend unique story elements</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                  <CardContent className="p-4 text-center">
                    <div className={`text-3xl mb-2 bg-gradient-to-r ${genre.color} bg-clip-text text-transparent`}>
                      {genre.icon}
                    </div>
                    <p className="font-medium">{genre.name}</p>
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
              <h3 className="text-2xl font-bold mb-2">Story Length</h3>
              <p className="text-muted-foreground">How much story do you want to tell?</p>
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
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="text-primary">{length.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{length.name}</h4>
                        <p className="text-primary font-medium">{length.pages}</p>
                        <p className="text-sm text-muted-foreground">{length.description}</p>
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
              <h3 className="text-2xl font-bold mb-2">Art Style</h3>
              <p className="text-muted-foreground">Choose the visual style for your comic</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-3">{style.icon}</div>
                    <h4 className="font-semibold">{style.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{style.description}</p>
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
              <h3 className="text-2xl font-bold mb-2">Story Tone</h3>
              <p className="text-muted-foreground">What's the overall mood and feel?</p>
            </div>
            <div className="space-y-4">
              {tones.map((tone) => (
                <Card 
                  key={tone.id}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedTone === tone.id 
                      ? "border-primary bg-primary/10 shadow-lg" 
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => setSelectedTone(tone.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl bg-gradient-to-r ${tone.color} bg-clip-text text-transparent`}>
                        {tone.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{tone.name}</h4>
                        <p className="text-sm text-muted-foreground">{tone.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 shadow-2xl">
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Story Generator
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step {currentStep} of 4
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        
        <CardContent className="p-8">
          {renderStep()}
        </CardContent>

        <div className="flex items-center justify-between p-6 border-t">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button 
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleGenerate}
              disabled={!canProceed() || isGenerating}
              className="bg-gradient-to-r from-primary to-accent"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Story...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate My Story!
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}