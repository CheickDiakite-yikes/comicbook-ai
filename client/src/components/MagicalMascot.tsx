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
      {/* Main mascot body - a friendly wizard */}
      <div className="relative w-full h-full cursor-pointer">
        {/* Wizard hat */}
        <motion.div
          className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-12 bg-gradient-to-b from-purple-600 to-purple-800 rounded-full"
          animate={isActive ? { rotate: [0, 15, -15, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          {/* Hat tip */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
          
          {/* Stars on hat */}
          <motion.div
            className="absolute top-2 left-1 text-yellow-300 text-xs"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ✨
          </motion.div>
        </motion.div>

        {/* Main body circle */}
        <motion.div
          className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-4 border-white shadow-lg relative overflow-hidden"
          animate={isActive ? { 
            boxShadow: [
              "0 0 20px rgba(59, 130, 246, 0.5)",
              "0 0 40px rgba(59, 130, 246, 0.8)",
              "0 0 20px rgba(59, 130, 246, 0.5)"
            ]
          } : {}}
        >
          {/* Eyes */}
          <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-white rounded-full">
            <motion.div 
              className="w-1 h-1 bg-black rounded-full m-0.5"
              animate={controls}
            />
          </div>
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-white rounded-full">
            <motion.div 
              className="w-1 h-1 bg-black rounded-full m-0.5"
              animate={controls}
            />
          </div>

          {/* Smile */}
          <motion.div
            className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 w-4 h-2 border-2 border-white rounded-b-full border-t-0"
            animate={isActive ? { scale: [1, 1.2, 1] } : {}}
          />

          {/* Magic wand */}
          <motion.div
            className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1"
            animate={isActive ? { 
              rotate: [0, 45, -45, 0],
              scale: [1, 1.2, 1]
            } : { rotate: 15 }}
            transition={{ duration: 0.6 }}
          >
            <Wand2 className="w-6 h-6 text-yellow-500" />
          </motion.div>
        </motion.div>

        {/* Magic sparkles around the mascot */}
        {isActive && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-yellow-400 text-lg pointer-events-none"
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: Math.cos(i * 60 * Math.PI / 180) * 40,
                  y: Math.sin(i * 60 * Math.PI / 180) * 40,
                  rotate: 360
                }}
                transition={{
                  duration: 1,
                  delay: i * 0.1,
                  ease: "easeOut"
                }}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                ✨
              </motion.div>
            ))}
          </>
        )}

        {/* Floating icons around mascot when active */}
        {isActive && (
          <>
            <motion.div
              className="absolute -top-8 -left-8 text-blue-500"
              initial={{ opacity: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                y: [-20, -40, -60],
                rotate: [0, 180, 360]
              }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              <BookOpen className="w-4 h-4" />
            </motion.div>
            
            <motion.div
              className="absolute -top-8 -right-8 text-purple-500"
              initial={{ opacity: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                y: [-20, -40, -60],
                rotate: [0, -180, -360]
              }}
              transition={{ duration: 2, delay: 0.3, ease: "easeOut" }}
            >
              <Zap className="w-4 h-4" />
            </motion.div>

            <motion.div
              className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-green-500"
              initial={{ opacity: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                y: [20, 40, 60],
                rotate: [0, 360, 720]
              }}
              transition={{ duration: 2, delay: 0.6, ease: "easeOut" }}
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}