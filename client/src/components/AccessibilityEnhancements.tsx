import { motion } from 'framer-motion';
import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Volume2, VolumeX, Sun, Moon } from 'lucide-react';

// Skip links for keyboard navigation
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-4 left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="absolute top-4 left-32 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to navigation
      </a>
    </div>
  );
}

// Accessible button with proper ARIA attributes
interface AccessibleButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AccessibleButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  ariaLabel,
  ariaDescribedBy,
  isLoading = false,
  disabled = false
}: AccessibleButtonProps) {
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    ghost: 'hover:bg-accent hover:text-accent-foreground focus:ring-accent'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      className={`
        ${variantStyles[variant]} 
        ${sizeStyles[size]} 
        rounded-md font-medium transition-colors 
        focus:outline-none focus:ring-2 focus:ring-offset-2 
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={isLoading}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
}

// Screen reader announcements
interface ScreenReaderAnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

export function ScreenReaderAnnouncement({ message, priority = 'polite' }: ScreenReaderAnnouncementProps) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Focus trap for modals and overlays
interface FocusTrapProps {
  children: ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}

export function FocusTrap({ children, isActive, onEscape }: FocusTrapProps) {
  const trapRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!trapRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])'
    ].join(',');

    return Array.from(trapRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const focusableElements = getFocusableElements();
    firstFocusableRef.current = focusableElements[0] || null;
    lastFocusableRef.current = focusableElements[focusableElements.length - 1] || null;

    // Focus first element
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        const activeElement = document.activeElement as HTMLElement;
        const currentIndex = focusableElements.indexOf(activeElement);

        if (e.shiftKey) {
          // Shift + Tab
          if (currentIndex <= 0) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1]?.focus();
          }
        } else {
          // Tab
          if (currentIndex >= focusableElements.length - 1) {
            e.preventDefault();
            focusableElements[0]?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape, getFocusableElements]);

  return <div ref={trapRef}>{children}</div>;
}

// Accessible accordion component
interface AccessibleAccordionProps {
  items: Array<{
    id: string;
    title: string;
    content: ReactNode;
  }>;
  allowMultiple?: boolean;
  className?: string;
}

export function AccessibleAccordion({ items, allowMultiple = false, className = '' }: AccessibleAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (!allowMultiple) {
          newSet.clear();
        }
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className={`space-y-2 ${className}`} role="region" aria-label="Accordion">
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        return (
          <div key={item.id} className="border border-border rounded-lg">
            <h3>
              <button
                className="w-full px-4 py-3 text-left font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-t-lg"
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                id={`header-${item.id}`}
              >
                <div className="flex items-center justify-between">
                  <span>{item.title}</span>
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </div>
              </button>
            </h3>
            <motion.div
              id={`panel-${item.id}`}
              role="region"
              aria-labelledby={`header-${item.id}`}
              initial={false}
              animate={{
                height: isOpen ? 'auto' : 0,
                opacity: isOpen ? 1 : 0
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 border-t border-border">
                {item.content}
              </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// Accessible media player controls
interface AccessibleMediaControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeToggle: () => void;
  onVolumeChange: (volume: number) => void;
  className?: string;
}

export function AccessibleMediaControls({
  isPlaying,
  isMuted,
  volume,
  onPlayPause,
  onVolumeToggle,
  onVolumeChange,
  className = ''
}: AccessibleMediaControlsProps) {
  return (
    <div className={`flex items-center space-x-4 ${className}`} role="group" aria-label="Media controls">
      <AccessibleButton
        onClick={onPlayPause}
        ariaLabel={isPlaying ? 'Pause media' : 'Play media'}
        variant="ghost"
        size="sm"
      >
        {isPlaying ? '⏸️' : '▶️'}
      </AccessibleButton>

      <div className="flex items-center space-x-2">
        <AccessibleButton
          onClick={onVolumeToggle}
          ariaLabel={isMuted ? 'Unmute' : 'Mute'}
          variant="ghost"
          size="sm"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </AccessibleButton>

        <label htmlFor="volume-slider" className="sr-only">
          Volume control
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={volume}
          aria-label={`Volume: ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  );
}

// High contrast mode support
export function useHighContrastMode() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isHighContrast;
}