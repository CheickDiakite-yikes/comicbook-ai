import { useEffect, useState, useCallback } from 'react';

interface ScrollPosition {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'none';
  progress: number; // 0-1 representing scroll progress
}

export function useScrollAnimation() {
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    x: 0,
    y: 0,
    direction: 'none',
    progress: 0
  });

  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);

  const updateScrollPosition = useCallback(() => {
    const currentY = window.scrollY;
    const currentX = window.scrollX;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = documentHeight > 0 ? currentY / documentHeight : 0;
    
    setScrollPosition(prev => ({
      x: currentX,
      y: currentY,
      direction: currentY > prev.y ? 'down' : currentY < prev.y ? 'up' : 'none',
      progress: Math.min(Math.max(progress, 0), 1)
    }));

    setIsScrolling(true);
    
    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    // Set new timeout to detect when scrolling stops
    const newTimeout = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    setScrollTimeout(newTimeout);
  }, [scrollTimeout]);

  useEffect(() => {
    window.addEventListener('scroll', updateScrollPosition, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', updateScrollPosition);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [updateScrollPosition, scrollTimeout]);

  return {
    scrollPosition,
    isScrolling,
    // Helper functions
    isNearTop: scrollPosition.y < 100,
    isNearBottom: scrollPosition.progress > 0.9,
    scrollProgress: scrollPosition.progress
  };
}