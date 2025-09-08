import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { Wand2, Sparkles, BookOpen, Zap } from 'lucide-react';

interface MagicalMascotProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function MagicalMascot({ 
  className = '', 
  size = 'md', 
  interactive = true 
}: MagicalMascotProps) {
  const controls = useAnimation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [lastBlink, setLastBlink] = useState(Date.now());
  const mascotRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  // Mouse following effect
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (mascotRef.current) {
        const rect = mascotRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const deltaX = (e.clientX - centerX) * 0.05;
        const deltaY = (e.clientY - centerY) * 0.05;
        
        setMousePosition({ x: deltaX, y: deltaY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive]);

  // Idle animations
  useEffect(() => {
    const runIdleAnimation = async () => {
      // Random blink every 3-6 seconds
      const now = Date.now();
      if (now - lastBlink > 3000 + Math.random() * 3000) {
        await controls.start({
          scaleY: [1, 0.1, 1],
          transition: { duration: 0.3 }
        });
        setLastBlink(now);
      }

      // Gentle floating
      controls.start({
        y: [0, -5, 0],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }
      });
    };

    const interval = setInterval(runIdleAnimation, 100);
    return () => clearInterval(interval);
  }, [controls, lastBlink]);

  // Interactive effects
  const handleClick = async () => {
    setIsActive(true);
    
    // Excited animation
    await controls.start({
      rotate: [0, -10, 10, -5, 5, 0],
      scale: [1, 1.2, 1],
      transition: { duration: 0.8, ease: "easeInOut" }
    });
    
    setIsActive(false);
  };

  const handleHover = () => {
    controls.start({
      scale: 1.1,
      rotate: 5,
      transition: { duration: 0.3 }
    });
  };

  const handleLeave = () => {
    controls.start({
      scale: 1,
      rotate: 0,
      transition: { duration: 0.3 }
    });
  };

  return (
    <motion.div
      ref={mascotRef}
      className={`relative ${sizeClasses[size]} ${className}`}
      animate={controls}
      style={{
        x: mousePosition.x,
        y: mousePosition.y
      }}
      onHoverStart={handleHover}
      onHoverEnd={handleLeave}
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
    >
      
    </motion.div>
  );
}