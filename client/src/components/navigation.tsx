import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { Moon, Menu, X, Home, Compass, User as UserIcon, BookOpen, LogOut, Wand2, Info } from "lucide-react";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [location] = useLocation();

  // Fetch credit data from API
  const { data: creditData } = useQuery<{
    isAdmin: boolean;
    monthlyLimit: number | null;
    currentCredits: number | null;
    remainingCredits: string | number;
    creditsPercentage: number;
    lastReset?: string;
  }>({ 
    queryKey: ["/api/credits"],
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Credit system logic with real data
  const isAdmin = creditData?.isAdmin || false;
  const monthlyLimit = creditData?.monthlyLimit || 200;
  const currentCredits = creditData?.currentCredits || 0;
  const remainingCredits = creditData?.remainingCredits || 0;
  const creditsPercentage = creditData?.creditsPercentage || 0;

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

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const navigationLinks = [
    { href: "/", label: "Dashboard", icon: Home, isActive: location === "/" },
    { href: "/explore", label: "Explore", icon: Compass, isActive: location === "/explore" },
    { href: "/profile", label: "Profile", icon: UserIcon, isActive: location === "/profile", requiresAuth: true },
  ];

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
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
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
                  <span className="text-sm font-medium" data-testid="text-username">
                    {user.firstName || user.email || "User"}
                  </span>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/api/logout'}
                  className="min-h-[44px] px-3"
                  aria-label="Logout"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                  Logout
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
                <UserIcon className="h-4 w-4 mr-2" aria-hidden="true" />
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Burger Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="md:hidden min-h-[44px] w-[44px] p-2"
            aria-label="Toggle mobile menu"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={toggleMobileMenu}
          style={{
            background: `linear-gradient(135deg, 
              rgb(59, 130, 246) 0%, 
              rgb(147, 51, 234) 25%, 
              rgb(236, 72, 153) 50%, 
              rgb(249, 115, 22) 75%, 
              rgb(34, 197, 94) 100%)`
          }}
        >
          {/* Comic book style background pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                radial-gradient(circle at 25% 25%, white 2px, transparent 2px),
                radial-gradient(circle at 75% 75%, white 2px, transparent 2px)
              `,
              backgroundSize: '40px 40px',
              backgroundPosition: '0 0, 20px 20px'
            }}
          />
          
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-2">
              <img 
                src={kumayiriLogo} 
                alt="Kumayiri Logo" 
                className="w-8 h-8 filter brightness-0 invert" 
              />
              <h2 className="text-xl font-serif font-bold text-white">Menu</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="text-white hover:bg-white/20 min-h-[44px] w-[44px] p-2"
              aria-label="Close mobile menu"
              data-testid="button-close-mobile-menu"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col px-4 py-8 space-y-6" onClick={(e) => e.stopPropagation()}>
            {navigationLinks.map((link) => {
              if (link.requiresAuth && !user) return null;
              const Icon = link.icon;
              
              return (
                <Link key={link.href} href={link.href}>
                  <button
                    className={`w-full flex items-center space-x-4 p-4 rounded-xl text-left transition-all duration-200 transform hover:scale-105 ${
                      link.isActive 
                        ? 'bg-white/20 shadow-lg border border-white/30' 
                        : 'hover:bg-white/10'
                    }`}
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    <div className={`p-3 rounded-lg ${
                      link.isActive 
                        ? 'bg-white/30' 
                        : 'bg-white/20'
                    }`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <span className="text-lg font-medium text-white">{link.label}</span>
                      {link.isActive && (
                        <div className="text-sm text-white/80">Current page</div>
                      )}
                    </div>
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Credit Tracker Section - Only show for authenticated users */}
          {user && (
            <div className="px-4 pb-6" onClick={(e) => e.stopPropagation()}>
              <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
                <DialogTrigger asChild>
                  <button
                    className="w-full flex items-center space-x-4 p-4 rounded-xl text-left transition-all duration-200 transform hover:scale-105 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-white/20 shadow-lg"
                    data-testid="button-mobile-credits"
                  >
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500">
                      <Wand2 className="h-6 w-6 text-white" />
                      {isAdmin && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                          <span className="text-xs text-purple-600 font-bold">∞</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-lg font-medium text-white">AI Credits</span>
                      <div className="text-sm text-white/80">
                        {isAdmin ? "Unlimited" : `${remainingCredits} / ${monthlyLimit} remaining`}
                      </div>
                      {!isAdmin && (
                        <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                          <div 
                            className="bg-gradient-to-r from-purple-400 to-blue-400 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${creditsPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-white/60">
                      <Info className="h-5 w-5" />
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-gradient-to-r from-chart-1 to-chart-2 text-white border-0 max-w-sm mx-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <Wand2 className="h-5 w-5" />
                      <span>AI Credits</span>
                      {isAdmin && (
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-mono">Admin</span>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm opacity-90">
                        {isAdmin ? "Unlimited credits" : `${remainingCredits} / ${monthlyLimit} remaining`}
                      </p>
                      {!isAdmin && (
                        <div className="w-full bg-white/20 rounded-full h-3 mt-2">
                          <div 
                            className="bg-white h-3 rounded-full transition-all duration-300" 
                            style={{ width: `${creditsPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <Info className="h-4 w-4 opacity-70" />
                        <span className="text-sm opacity-70 font-medium">How Credits Work</span>
                      </div>
                      <p className="text-sm opacity-80 leading-relaxed">
                        1 credit = 1 panel generation. {!isAdmin && "200 credits refresh monthly."}
                        <br />
                        <span className="opacity-60">More credit options coming soon!</span>
                      </p>
                    </div>

                    {!isAdmin && creditData?.lastReset && (
                      <div className="pt-2 border-t border-white/20">
                        <p className="text-xs opacity-60">
                          Credits last reset: {new Date(creditData.lastReset).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* User Section */}
          {user && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20 bg-black/20" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {user.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile picture" 
                      className="w-12 h-12 rounded-full border-2 border-white/30 object-cover" 
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">
                      {user.firstName || user.email || "User"}
                    </div>
                    <div className="text-white/70 text-sm">Creator</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/api/logout'}
                  className="text-white hover:bg-white/20 p-3"
                  aria-label="Logout"
                  data-testid="button-mobile-logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Sign In Section for non-authenticated users */}
          {!user && (
            <div className="absolute bottom-0 left-0 right-0 p-4" onClick={(e) => e.stopPropagation()}>
              <Button
                onClick={() => window.location.href = '/api/login'}
                className="w-full bg-white text-gray-900 hover:bg-white/90 font-medium py-3 text-lg"
                data-testid="button-mobile-sign-in"
              >
                <UserIcon className="h-5 w-5 mr-2" />
                Sign In to Create Comics
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
