import { motion } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ComicPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
  panelStyle?: 'classic' | 'modern' | 'action' | 'thought';
  soundEffect?: string;
  borderColor?: string;
  bgPattern?: 'dots' | 'lines' | 'solid';
  hoverEffect?: boolean;
}

export function ComicPanel({
  children,
  title,
  className = '',
  panelStyle = 'classic',
  soundEffect,
  borderColor = 'border-black',
  bgPattern = 'solid',
  hoverEffect = true
}: ComicPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showSoundEffect, setShowSoundEffect] = useState(false);

  const panelStyles = {
    classic: {
      border: '4px solid black',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
    },
    modern: {
      border: '3px solid black',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
    },
    action: {
      border: '5px solid black',
      borderRadius: '4px',
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde047 100%)',
      transform: 'rotate(-1deg)'
    },
    thought: {
      border: '3px dashed black',
      borderRadius: '50px',
      background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)'
    }
  };

  const backgroundPatterns = {
    dots: {
      backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)`,
      backgroundSize: '10px 10px'
    },
    lines: {
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 6px)`,
    },
    solid: {}
  };

  const handleClick = () => {
    if (soundEffect) {
      setShowSoundEffect(true);
      setTimeout(() => setShowSoundEffect(false), 800);
    }
  };

  return (
    <motion.div
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      whileHover={hoverEffect ? {
        scale: 1.05,
        rotate: panelStyle === 'action' ? 0 : 1,
        y: -10
      } : {}}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      {/* Panel shadow for depth */}
      <div 
        className="absolute inset-0 bg-black rounded-lg transform translate-x-1 translate-y-1 -z-10"
        style={{ ...panelStyles[panelStyle] }}
      />
      
      {/* Main panel */}
      <div
        className={`relative border-4 ${borderColor} bg-white shadow-lg overflow-hidden`}
        style={{ 
          ...panelStyles[panelStyle],
          ...backgroundPatterns[bgPattern]
        }}
      >
        {/* Title banner if provided */}
        {title && (
          <motion.div
            className="absolute -top-3 left-4 bg-black text-white px-3 py-1 font-bold text-sm transform -rotate-2 z-10"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            {title}
          </motion.div>
        )}

        {/* Content */}
        <div className="relative z-5">
          {children}
        </div>

        {/* Sound effect bubble */}
        {soundEffect && showSoundEffect && (
          <motion.div
            className="absolute top-2 right-2 z-20"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 10 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="bg-yellow-300 border-3 border-black rounded-full px-3 py-1 font-bold text-black text-sm transform rotate-12 shadow-lg">
              {soundEffect}
              {/* Speech bubble pointer */}
              <div className="absolute -bottom-1 left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black" />
            </div>
          </motion.div>
        )}

        {/* Hover action lines */}
        {hoverEffect && isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute bg-black h-0.5"
                style={{
                  width: '15px',
                  transformOrigin: 'center',
                  left: '50%',
                  top: '50%',
                  transform: `rotate(${i * 45}deg) translateX(30px)`
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              />
            ))}
          </motion.div>
        )}

        {/* Comic book action sparkles */}
        {isHovered && (
          <>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-yellow-400 text-lg pointer-events-none"
                style={{
                  left: `${20 + i * 30}%`,
                  top: `${10 + (i % 2) * 80}%`
                }}
                initial={{ opacity: 0, scale: 0, rotate: 0 }}
                animate={{ 
                  opacity: [0, 1, 0], 
                  scale: [0, 1, 0],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 1,
                  delay: i * 0.2,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
              >
                ✨
              </motion.div>
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}

interface ComicSpeechBubbleProps {
  text: string;
  className?: string;
  variant?: 'speech' | 'thought' | 'shout' | 'whisper';
  color?: string;
  tailDirection?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export function ComicSpeechBubble({
  text,
  className = '',
  variant = 'speech',
  color = 'bg-white',
  tailDirection = 'bottom-left'
}: ComicSpeechBubbleProps) {
  const variantStyles = {
    speech: {
      border: '3px solid black',
      borderRadius: '20px'
    },
    thought: {
      border: '3px solid black',
      borderRadius: '30px',
      borderStyle: 'dashed'
    },
    shout: {
      border: '4px solid black',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde047 100%)'
    },
    whisper: {
      border: '2px solid black',
      borderRadius: '15px',
      borderStyle: 'dotted'
    }
  };

  const tailPositions = {
    'bottom-left': {
      position: 'absolute',
      bottom: '-8px',
      left: '20px',
      borderTop: '12px solid black',
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent'
    },
    'bottom-right': {
      position: 'absolute',
      bottom: '-8px',
      right: '20px',
      borderTop: '12px solid black',
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent'
    },
    'top-left': {
      position: 'absolute',
      top: '-8px',
      left: '20px',
      borderBottom: '12px solid black',
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent'
    },
    'top-right': {
      position: 'absolute',
      top: '-8px',
      right: '20px',
      borderBottom: '12px solid black',
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent'
    }
  };

  return (
    <motion.div
      className={`relative inline-block ${color} ${className}`}
      style={variantStyles[variant]}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <div className="px-4 py-2 font-bold text-black text-center">
        {text}
      </div>
      
      {/* Speech bubble tail */}
      <div style={tailPositions[tailDirection] as any} />
      
      {/* Inner tail for clean look */}
      <div 
        style={{
          ...tailPositions[tailDirection],
          [tailDirection.includes('bottom') ? 'bottom' : 'top']: '-6px',
          [`border${tailDirection.includes('bottom') ? 'Top' : 'Bottom'}Color`]: color.includes('bg-') ? 'white' : color
        } as any}
      />
    </motion.div>
  );
}