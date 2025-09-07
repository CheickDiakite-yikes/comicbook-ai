import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Moon, Palette } from "lucide-react";
import { useState } from "react";

export default function Navigation() {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      html.classList.add('light');
      setIsDarkMode(false);
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  return (
    <nav className="bg-card border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Palette className="text-primary text-2xl" />
          <h1 className="text-xl font-serif font-bold text-primary">ComicAI Studio</h1>
          <span className="text-xs bg-chart-3 text-white px-2 py-1 rounded-full font-mono">Beta</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={toggleDarkMode}
          data-testid="button-toggle-theme"
        >
          <Moon className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex items-center space-x-2">
          {user?.profileImageUrl && (
            <img 
              src={user.profileImageUrl} 
              alt="User avatar" 
              className="w-8 h-8 rounded-full border-2 border-primary object-cover" 
            />
          )}
          <span className="text-sm font-medium" data-testid="text-username">
            {user?.firstName || user?.email || "User"}
          </span>
        </div>
      </div>
    </nav>
  );
}
