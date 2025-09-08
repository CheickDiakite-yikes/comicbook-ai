import { motion, useReducedMotion, useAnimation } from 'framer-motion';
import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';

// Lazy loading hook for heavy components
export function useLazyLoad<T>(
  importFunc: () => Promise<{ default: T }>,
  delay: number = 0
) {
  const [component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (component) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      const loaded = await importFunc();
      setComponent(loaded.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setIsLoading(false);
    }
  }, [component, importFunc, delay]);

  return { component, isLoading, error, loadComponent };
}

// Intersection observer for lazy loading
interface LazyLoadWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export function LazyLoadWrapper({
  children,
  fallback = <div className="animate-pulse bg-gray-200 rounded h-32" />,
  rootMargin = '50px',
  threshold = 0.1,
  className = ''
}: LazyLoadWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
        }
      },
      { rootMargin, threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold, hasLoaded]);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback}
    </div>
  );
}

// Performance-aware animation component
interface PerformanceAnimationProps {
  children: ReactNode;
  className?: string;
  animationLevel?: 'none' | 'reduced' | 'full';
  fallbackContent?: ReactNode;
}

export function PerformanceAnimation({
  children,
  className = '',
  animationLevel = 'full',
  fallbackContent
}: PerformanceAnimationProps) {
  const shouldReduceMotion = useReducedMotion();
  const [performanceLevel, setPerformanceLevel] = useState<'low' | 'medium' | 'high'>('high');

  useEffect(() => {
    // Detect performance level based on device capabilities
    const checkPerformance = () => {
      const memory = (navigator as any).deviceMemory;
      const connection = (navigator as any).connection;
      
      if (memory && memory < 2) {
        setPerformanceLevel('low');
      } else if (connection && (connection.effectiveType === '2g' || connection.effectiveType === '3g')) {
        setPerformanceLevel('low');
      } else if (memory && memory < 4) {
        setPerformanceLevel('medium');
      } else {
        setPerformanceLevel('high');
      }
    };

    checkPerformance();
  }, []);

  const getAnimationVariant = () => {
    if (shouldReduceMotion || animationLevel === 'none' || performanceLevel === 'low') {
      return {
        initial: {},
        animate: {},
        transition: { duration: 0 }
      };
    }

    if (animationLevel === 'reduced' || performanceLevel === 'medium') {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 }
      };
    }

    return {
      initial: { opacity: 0, y: 20, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.6, ease: "easeOut" }
    };
  };

  if (shouldReduceMotion && fallbackContent) {
    return <div className={className}>{fallbackContent}</div>;
  }

  return (
    <motion.div
      className={className}
      {...getAnimationVariant()}
    >
      {children}
    </motion.div>
  );
}

// Memory-conscious particle system
interface OptimizedParticleSystemProps {
  particleCount?: number;
  maxParticles?: number;
  className?: string;
  color?: string;
}

export function OptimizedParticleSystem({
  particleCount = 20,
  maxParticles = 50,
  className = '',
  color = '#3B82F6'
}: OptimizedParticleSystemProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const [isVisible, setIsVisible] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const animationRef = useRef<number>();

  useEffect(() => {
    // Don't render particles if motion is reduced or on low-end devices
    if (shouldReduceMotion) {
      setIsVisible(false);
      return;
    }

    // Check if page is visible to pause animations when not in view
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    const actualParticleCount = Math.min(particleCount, maxParticles);
    const newParticles = Array.from({ length: actualParticleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1
    }));
    setParticles(newParticles);
  }, [particleCount, maxParticles]);

  if (!isVisible || shouldReduceMotion) {
    return null;
  }

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full opacity-60"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: color,
            willChange: 'transform'
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2
          }}
        />
      ))}
    </div>
  );
}

// Resource preloader
export function useResourcePreloader(urls: string[]) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (urls.length === 0) {
      setIsLoading(false);
      return;
    }

    let loaded = 0;
    const promises = urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Preload image
          const img = new Image();
          img.onload = () => {
            loaded += 1;
            setLoadedCount(loaded);
            resolve();
          };
          img.onerror = reject;
          img.src = url;
        } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
          // Preload video
          const video = document.createElement('video');
          video.onloadeddata = () => {
            loaded += 1;
            setLoadedCount(loaded);
            resolve();
          };
          video.onerror = reject;
          video.src = url;
          video.preload = 'metadata';
        } else {
          // Generic fetch for other resources
          fetch(url)
            .then(() => {
              loaded += 1;
              setLoadedCount(loaded);
              resolve();
            })
            .catch(reject);
        }
      });
    });

    Promise.allSettled(promises).finally(() => {
      setIsLoading(false);
    });
  }, [urls]);

  return {
    isLoading,
    loadedCount,
    totalCount: urls.length,
    progress: urls.length > 0 ? loadedCount / urls.length : 1
  };
}

// Frame rate monitor for performance debugging
export function useFrameRate() {
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const updateFPS = () => {
      frameCount.current++;
      const currentTime = Date.now();
      const elapsed = currentTime - startTime.current;

      if (elapsed >= 1000) {
        const currentFPS = Math.round((frameCount.current * 1000) / elapsed);
        setFps(currentFPS);
        frameCount.current = 0;
        startTime.current = currentTime;
      }

      requestAnimationFrame(updateFPS);
    };

    const rafId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}