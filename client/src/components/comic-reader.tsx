import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { comicLayouts } from "@/lib/comic-layouts";

interface Page {
  id: string;
  pageNumber: number;
  title: string;
  layoutTemplate: string;
  backgroundImageUrl?: string;
}

interface Panel {
  id: string;
  pageId: string;
  panelNumber: number;
  imageUrl: string;
  action: string;
}

interface ComicReaderProps {
  pages: Page[];
  panels: Panel[];
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  onClose: () => void;
  projectTitle?: string;
}

export function ComicReader({ 
  pages, 
  panels, 
  currentPageIndex, 
  onPageChange, 
  onClose, 
  projectTitle 
}: ComicReaderProps) {
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout>();

  const currentPage = pages[currentPageIndex];
  const currentPanels = currentPage ? panels.filter(p => p.pageId === currentPage.id) : [];
  
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pages.length - 1;

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (!showControls) return;
    
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlay) {
      autoPlayRef.current = setInterval(() => {
        if (canGoNext) {
          onPageChange(currentPageIndex + 1);
        } else {
          setIsAutoPlay(false); // Stop at the end
        }
      }, 4000); // 4 seconds per page
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlay, currentPageIndex, canGoNext, onPageChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (canGoPrev) onPageChange(currentPageIndex - 1);
          break;
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          if (canGoNext) onPageChange(currentPageIndex + 1);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsAutoPlay(!isAutoPlay);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, canGoPrev, canGoNext, onPageChange, onClose, isAutoPlay]);

  // Touch/Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(true);
    setShowControls(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startX || !isDragging) return;
    setCurrentX(e.touches[0].clientX);
  }, [startX, isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!startX || !currentX || !isDragging) {
      setStartX(null);
      setCurrentX(null);
      setIsDragging(false);
      return;
    }

    const deltaX = currentX - startX;
    const threshold = 50;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && canGoPrev) {
        // Swipe right -> Previous page
        onPageChange(currentPageIndex - 1);
      } else if (deltaX < 0 && canGoNext) {
        // Swipe left -> Next page
        onPageChange(currentPageIndex + 1);
      }
    }

    setStartX(null);
    setCurrentX(null);
    setIsDragging(false);
  }, [startX, currentX, isDragging, canGoPrev, canGoNext, currentPageIndex, onPageChange]);

  // Mouse handlers for desktop drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setIsDragging(true);
    setShowControls(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!startX || !isDragging) return;
    setCurrentX(e.clientX);
  }, [startX, isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!startX || !currentX || !isDragging) {
      setStartX(null);
      setCurrentX(null);
      setIsDragging(false);
      return;
    }

    const deltaX = currentX - startX;
    const threshold = 100;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && canGoPrev) {
        onPageChange(currentPageIndex - 1);
      } else if (deltaX < 0 && canGoNext) {
        onPageChange(currentPageIndex + 1);
      }
    }

    setStartX(null);
    setCurrentX(null);
    setIsDragging(false);
  }, [startX, currentX, isDragging, canGoPrev, canGoNext, currentPageIndex, onPageChange]);

  const swipeOffset = startX && currentX && isDragging ? currentX - startX : 0;

  return (
    <div 
      ref={readerRef}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => setShowControls(!showControls)}
    >
      {/* Page Content */}
      <div 
        className={cn(
          "relative w-full h-full max-w-4xl max-h-[90vh] mx-4 transition-transform duration-300 ease-out",
          isDragging && swipeOffset !== 0 && "scale-[0.98]"
        )}
        style={{
          transform: isDragging && swipeOffset !== 0 ? `translateX(${swipeOffset * 0.1}px)` : undefined
        }}
      >
        {/* Page Background */}
        {currentPage?.backgroundImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center rounded-lg"
            style={{ backgroundImage: `url(${currentPage.backgroundImageUrl})` }}
          />
        )}

        {/* Page Content */}
        <div className="relative w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Page Background Layer */}
          {currentPage?.backgroundImageUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentPage.backgroundImageUrl})` }}
            />
          )}
          {currentPanels.length > 0 ? (
            <div className="w-full h-full relative p-1">
              {(() => {
                // Get the layout for this page
                const layout = comicLayouts.find(l => l.id === currentPage?.layoutTemplate) || comicLayouts[0];
                
                return layout.panels.map((layoutPanel, index) => {
                  const panelNumber = index + 1;
                  const panel = currentPanels.find(p => p.panelNumber === panelNumber);
                  
                  if (!panel) {
                    // Skip empty panel slots
                    return null;
                  }
                  
                  return (
                    <div
                      key={panel.id}
                      className="absolute overflow-hidden rounded"
                      style={{
                        left: `${layoutPanel.x * 100}%`,
                        top: `${layoutPanel.y * 100}%`,
                        width: `${layoutPanel.width * 100}%`,
                        height: `${layoutPanel.height * 100}%`,
                      }}
                    >
                      <img 
                        src={panel.imageUrl} 
                        alt={panel.action}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No panels available for this page
            </div>
          )}
        </div>
      </div>

      {/* Controls Overlay */}
      <div className={cn(
        "absolute inset-0 pointer-events-none transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h2 className="text-lg font-semibold">{projectTitle || "Comic Reader"}</h2>
              <p className="text-sm text-white/80">Page {currentPageIndex + 1} of {pages.length}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
              data-testid="button-close-reader"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation Buttons */}
        {canGoPrev && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPageIndex - 1)}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12 rounded-full pointer-events-auto"
            data-testid="button-reader-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        {canGoNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPageIndex + 1)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12 rounded-full pointer-events-auto"
            data-testid="button-reader-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 pointer-events-auto">
          <div className="flex items-center justify-center space-x-4">
            {/* Auto-play toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="text-white hover:bg-white/20"
              data-testid="button-autoplay-toggle"
            >
              {isAutoPlay ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-2">{isAutoPlay ? "Pause" : "Auto-play"}</span>
            </Button>

            {/* Page indicator */}
            <div className="flex space-x-1">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => onPageChange(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    index === currentPageIndex 
                      ? "bg-white w-6" 
                      : "bg-white/40 hover:bg-white/60"
                  )}
                  data-testid={`dot-page-${index}`}
                />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center mt-2">
            <p className="text-xs text-white/60">
              Swipe or use arrow keys to navigate • Press P for auto-play • ESC to exit
            </p>
          </div>
        </div>
      </div>

      {/* Swipe indicator */}
      {isDragging && swipeOffset !== 0 && (
        <div className={cn(
          "absolute top-1/2 transform -translate-y-1/2 text-white/60 pointer-events-none text-sm",
          swipeOffset > 50 && canGoPrev && "left-8",
          swipeOffset < -50 && canGoNext && "right-8"
        )}>
          {swipeOffset > 50 && canGoPrev && "← Previous"}
          {swipeOffset < -50 && canGoNext && "Next →"}
        </div>
      )}
    </div>
  );
}