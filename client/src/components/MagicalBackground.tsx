import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface FloatingElement {
  id: number;
  x: number;
  y: number;
  size: number;
  icon: string;
  color: string;
  duration: number;
  delay: number;
}

interface MagicalBackgroundProps {
  className?: string;
  density?: 'light' | 'medium' | 'heavy';
  theme?: 'comic' | 'magical' | 'creative';
}

export function MagicalBackground({ 
  className = '', 
  density = 'medium',
  theme = 'magical'
}: MagicalBackgroundProps) {
  const [elements, setElements] = useState<FloatingElement[]>([]);

  const densityConfig = {
    light: 12,
    medium: 20,
    heavy: 30
  };

  const themeConfig = {
    comic: {
      icons: ['💥', '⭐', '💫', '🎨', '✨', '🎭', '📚', '🖼️'],
      colors: ['text-yellow-400', 'text-blue-400', 'text-red-400', 'text-green-400', 'text-purple-400']
    },
    magical: {
      icons: ['✨', '⭐', '🌟', '💫', '🔮', '🪄', '🌙', '☄️'],
      colors: ['text-blue-300', 'text-purple-300', 'text-pink-300', 'text-indigo-300', 'text-cyan-300']
    },
    creative: {
      icons: ['🎨', '✏️', '🖌️', '📝', '💡', '🎭', '🎪', '🎨'],
      colors: ['text-orange-400', 'text-pink-400', 'text-green-400', 'text-blue-400', 'text-purple-400']
    }
  };

  useEffect(() => {
    const config = themeConfig[theme];
    const count = densityConfig[density];
    
    const newElements: FloatingElement[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      icon: config.icons[Math.floor(Math.random() * config.icons.length)],
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      duration: Math.random() * 20 + 15, // 15-35 seconds
      delay: Math.random() * 5
    }));

    setElements(newElements);
  }, [density, theme]);

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Comic book halftone pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.3) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />
      
      {/* Floating elements */}
      {elements.map((element) => (
        <motion.div
          key={element.id}
          className={`absolute ${element.color} select-none`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            fontSize: `${element.size}rem`,
            zIndex: -1
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(element.id) * 20, 0],
            rotate: [0, 360],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: element.duration,
            delay: element.delay,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          {element.icon}
        </motion.div>
      ))}

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
      
      {/* Corner accents */}
      <motion.div
        className="absolute top-10 left-10 text-6xl text-yellow-400/20"
        animate={{
          rotate: [0, 15, -15, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        ✨
      </motion.div>
      
      <motion.div
        className="absolute top-20 right-20 text-4xl text-blue-400/20"
        animate={{
          rotate: [0, -15, 15, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      >
        🌟
      </motion.div>
      
      <motion.div
        className="absolute bottom-20 left-20 text-5xl text-purple-400/20"
        animate={{
          rotate: [0, 20, -20, 0],
          scale: [1, 1.15, 1]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4
        }}
      >
        🎨
      </motion.div>

      {/* Magic sparkle trail effect */}
      <motion.div
        className="absolute inset-0"
        initial={{ background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0) 0%, rgba(59, 130, 246, 0) 100%)' }}
        animate={{
          background: [
            'radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 50%)',
            'radial-gradient(circle at 80% 70%, rgba(147, 51, 234, 0.1) 0%, rgba(147, 51, 234, 0) 50%)',
            'radial-gradient(circle at 40% 80%, rgba(236, 72, 153, 0.1) 0%, rgba(236, 72, 153, 0) 50%)',
            'radial-gradient(circle at 60% 20%, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 50%)'
          ]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}