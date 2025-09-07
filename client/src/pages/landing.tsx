import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, BookOpen, Wand2, Users } from "lucide-react";
import { FaGoogle } from "react-icons/fa";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <Palette className="text-primary text-2xl" />
          <h1 className="text-xl font-serif font-bold text-primary">ComicAI Studio</h1>
          <span className="text-xs bg-chart-3 text-white px-2 py-1 rounded-full font-mono">Beta</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => window.location.href = '/api/auth/google'}
            variant="outline"
            className="border-border hover:bg-muted"
            data-testid="button-google-login"
          >
            <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
            Google
          </Button>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-replit-login"
          >
            Sign In with Replit
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-serif font-bold mb-6 text-foreground">
            Create Amazing Comics with AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            The ultimate comic creation platform powered by AI. Build your story bible once, 
            then generate stunning comic pages while maintaining perfect character and style consistency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/auth/google'}
              className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-3"
              data-testid="button-get-started-google"
            >
              <FaGoogle className="mr-2 h-5 w-5" />
              Get Started with Google
            </Button>
            <div className="text-muted-foreground text-sm">or</div>
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-lg px-8 py-3"
              data-testid="button-get-started-replit"
            >
              <Wand2 className="mr-2 h-5 w-5" />
              Get Started with Replit
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-chart-1 to-chart-2 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Story Bible</h3>
              <p className="text-sm text-muted-foreground">
                Define characters, settings, and rules once. AI remembers everything.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-chart-3 to-chart-4 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Wand2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Generation</h3>
              <p className="text-sm text-muted-foreground">
                Generate panels individually or entire pages with context awareness.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-chart-5 to-destructive rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Character Consistency</h3>
              <p className="text-sm text-muted-foreground">
                Characters look the same across all panels with advanced AI memory.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-chart-2 to-chart-1 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Palette className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Multiple Styles</h3>
              <p className="text-sm text-muted-foreground">
                From manga to western comics, choose your perfect art style.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Demo Section */}
        <div className="text-center">
          <h2 className="text-3xl font-serif font-bold mb-8">See It In Action</h2>
          <div className="bg-card rounded-xl border border-border p-8">
            <div className="aspect-video bg-gradient-to-br from-muted to-accent rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Palette className="h-16 w-16 text-primary mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  Interactive Demo Coming Soon
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Experience the full comic creation workflow
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            Built for the Nano Banana Hackathon • Powered by AI • Made with ❤️
          </p>
        </div>
      </footer>
    </div>
  );
}
