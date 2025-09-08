import { motion } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';

interface MobileAwareComponentProps {
  children: ReactNode;
  mobileChildren?: ReactNode;
  breakpoint?: number;
  className?: string;
}

export function MobileAwareComponent({
  children,
  mobileChildren,
  breakpoint = 768,
  className = ''
}: MobileAwareComponentProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return (
    <div className={className}>
      {isMobile && mobileChildren ? mobileChildren : children}
    </div>
  );
}

interface TouchFriendlyButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  hapticFeedback?: boolean;
}

export function TouchFriendlyButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  hapticFeedback = true
}: TouchFriendlyButtonProps) {
  const handleClick = () => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50); // Light haptic feedback
    }
    onClick?.();
  };

  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };

  const sizeStyles = {
    sm: 'min-h-[44px] px-3 py-2 text-sm',
    md: 'min-h-[48px] px-4 py-3 text-base',
    lg: 'min-h-[52px] px-6 py-4 text-lg'
  };

  return (
    <motion.button
      className={`${variantStyles[variant]} ${sizeStyles[size]} rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
      onClick={handleClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
}

interface SwipeGestureProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  className?: string;
}

export function SwipeGesture({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  className = ''
}: SwipeGestureProps) {
  const [startTouch, setStartTouch] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartTouch({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!startTouch) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startTouch.x;
    const deltaY = touch.clientY - startTouch.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    setStartTouch(null);
  };

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}

interface MobileOptimizedAnimationProps {
  children: ReactNode;
  className?: string;
  reducedMotion?: boolean;
}

export function MobileOptimizedAnimation({
  children,
  className = '',
  reducedMotion = false
}: MobileOptimizedAnimationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const checkReducedMotion = () => {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    checkMobile();
    checkReducedMotion();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shouldReduceAnimation = reducedMotion || prefersReducedMotion || isMobile;

  return (
    <motion.div
      className={className}
      initial={shouldReduceAnimation ? {} : { opacity: 0, y: 20 }}
      animate={shouldReduceAnimation ? {} : { opacity: 1, y: 0 }}
      transition={shouldReduceAnimation ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

interface MobileParticleSystemProps {
  className?: string;
  particleCount?: number;
}

export function MobileParticleSystem({
  className = '',
  particleCount = 15
}: MobileParticleSystemProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 ${className}`}>
      {/* Simplified particle effect for mobile */}
      {[...Array(particleCount)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}

interface ResponsiveTextProps {
  children: ReactNode;
  className?: string;
  mobileClassName?: string;
  tabletClassName?: string;
  desktopClassName?: string;
}

export function ResponsiveText({
  children,
  className = '',
  mobileClassName = '',
  tabletClassName = '',
  desktopClassName = ''
}: ResponsiveTextProps) {
  return (
    <div className={`
      ${className}
      ${mobileClassName ? `sm:hidden ${mobileClassName}` : ''}
      ${tabletClassName ? `hidden sm:block lg:hidden ${tabletClassName}` : ''}
      ${desktopClassName ? `hidden lg:block ${desktopClassName}` : ''}
    `}>
      {children}
    </div>
  );
}

// Hook for detecting mobile device capabilities
export function useMobileCapabilities() {
  const [capabilities, setCapabilities] = useState({
    isTouchDevice: false,
    hasVibration: false,
    hasDeviceOrientation: false,
    supportsPWA: false,
    isStandalone: false
  });

  useEffect(() => {
    setCapabilities({
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasVibration: 'vibrate' in navigator,
      hasDeviceOrientation: 'DeviceOrientationEvent' in window,
      supportsPWA: 'serviceWorker' in navigator && 'PushManager' in window,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches
    });
  }, []);

  return capabilities;
}