import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Moon, Menu, PanelLeftClose, PanelLeft, LogOut, User } from "lucide-react";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";
import { useState } from "react";
import type { User as UserType } from "@shared/schema";

interface NavigationProps {
  onToggleSidebar?: () => void;
  showMobileToggle?: boolean;
  sidebarOpen?: boolean;
  showDesktopToggle?: boolean;
}

export default function Navigation({ onToggleSidebar, showMobileToggle = false, sidebarOpen, showDesktopToggle = false }: NavigationProps) {
  const { user } = useAuth() as { user: UserType | undefined };
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
    <header role="banner" className="sticky top-0 z-50">
      <nav 
        className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm"
        style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}
        aria-label="Main navigation"
      >
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <Link href="/">
            <button 
              className="flex items-center space-x-2 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
              data-testid="logo-home-link"
              aria-label="Go to home page"
            >
              <img 
                src={kumayiriLogo} 
                alt="Kumayiri Logo" 
                className="w-8 h-8 flex-shrink-0" 
                aria-hidden="true" 
              />
              <h1 className="text-lg sm:text-xl font-serif font-bold text-primary truncate">Kumayiri</h1>
              <span className="text-xs bg-chart-3 text-white px-2 py-1 rounded-full font-mono">Beta</span>
            </button>
          </Link>
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
          
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                {user.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile picture" 
                    className="w-8 h-8 rounded-full border-2 border-primary object-cover" 
                  />
                )}
                <span className="text-sm font-medium hidden sm:inline" data-testid="text-username">
                  {user.firstName || user.email || "User"}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/api/logout'}
                className="min-h-[44px] w-[44px] p-2 md:w-auto md:px-3"
                aria-label="Logout"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:ml-2 md:inline">Logout</span>
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = '/api/login'}
              className="min-h-[44px] px-4"
              data-testid="button-sign-in"
            >
              <User className="h-4 w-4 mr-2" aria-hidden="true" />
              Sign In
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
