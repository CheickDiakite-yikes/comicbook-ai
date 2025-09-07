import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Moon, Palette, Menu } from "lucide-react";
import { useState } from "react";
import type { User } from "@shared/schema";

interface NavigationProps {
  onToggleSidebar?: () => void;
  showMobileToggle?: boolean;
}

export default function Navigation({ onToggleSidebar, showMobileToggle = false }: NavigationProps) {
  const { user } = useAuth() as { user: User | undefined };
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
    <header role="banner">
      <nav 
        className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm"
        style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}
        aria-label="Main navigation"
      >
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          {showMobileToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden min-h-[44px] w-[44px] p-2"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar menu"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <div className="flex items-center space-x-2 min-w-0">
            <Palette className="text-primary text-2xl flex-shrink-0" aria-hidden="true" />
            <h1 className="text-lg sm:text-xl font-serif font-bold text-primary truncate">ComicAI Studio</h1>
            <span className="text-xs bg-chart-3 text-white px-2 py-1 rounded-full font-mono">Beta</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleDarkMode}
            className="min-h-[44px] w-[44px] p-2"
            aria-label="Toggle dark mode"
            data-testid="button-toggle-theme"
          >
            <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Button>
          <div className="flex items-center space-x-2">
            {user?.profileImageUrl && (
              <img 
                src={user.profileImageUrl} 
                alt="Profile picture" 
                className="w-8 h-8 rounded-full border-2 border-primary object-cover" 
              />
            )}
            <span className="text-sm font-medium hidden sm:inline" data-testid="text-username">
              {user?.firstName || user?.email || "User"}
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
}
