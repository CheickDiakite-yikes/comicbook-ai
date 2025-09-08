import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  showCursor?: boolean;
  onComplete?: () => void;
  comicStyle?: boolean;
}

export function TypewriterText({
  text,
  className = '',
  speed = 50,
  delay = 0,
  showCursor = true,
  onComplete,
  comicStyle = false
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, currentIndex === 0 ? delay : speed);

      return () => clearTimeout(timer);
    } else if (!isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, delay, isComplete, onComplete]);

  if (comicStyle) {
    return (
      <div className={`relative inline-block ${className}`}>
        {/* Comic book speech bubble background */}
        <div className="absolute inset-0 bg-white border-4 border-black rounded-xl shadow-lg transform -translate-y-2 -translate-x-2" />
        
        {/* Main text content */}
        <div className="relative bg-yellow-100 border-4 border-black rounded-xl px-4 py-2 font-bold text-black">
          <span className="font-mono text-lg">
            {displayedText}
            {showCursor && !isComplete && (
              <motion.span
                className="inline-block bg-black text-yellow-100 px-1 ml-1"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                |
              </motion.span>
            )}
          </span>
          
          {/* Speech bubble pointer */}
          <div className="absolute -bottom-4 left-8 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black" />
          <div className="absolute -bottom-3 left-8 w-0 h-0 border-l-7 border-r-7 border-t-7 border-transparent border-t-yellow-100" />
        </div>

        {/* Comic book action lines */}
        <div className="absolute -inset-4 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute bg-black h-0.5"
              style={{
                width: '20px',
                transformOrigin: 'left center',
                left: '50%',
                top: '50%',
                transform: `rotate(${i * 45}deg) translateX(40px)`
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isComplete ? 1 : 0 }}
              transition={{ duration: 0.3, delay: isComplete ? i * 0.05 : 0 }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className={className}>
      {displayedText}
      {showCursor && !isComplete && (
        <motion.span
          className="inline-block"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          |
        </motion.span>
      )}
    </span>
  );
}

interface AnimatedWordProps {
  word: string;
  index: number;
  comicEffect?: 'pop' | 'zoom' | 'bounce' | 'glow';
}

function AnimatedWord({ word, index, comicEffect = 'pop' }: AnimatedWordProps) {
  const effects = {
    pop: {
      initial: { opacity: 0, scale: 0 },
      animate: { opacity: 1, scale: 1 },
      transition: { 
        type: "spring", 
        stiffness: 200, 
        damping: 10,
        delay: index * 0.1
      }
    },
    zoom: {
      initial: { opacity: 0, scale: 0.5, y: 20 },
      animate: { opacity: 1, scale: 1, y: 0 },
      transition: { 
        duration: 0.5, 
        ease: "backOut",
        delay: index * 0.1
      }
    },
    bounce: {
      initial: { opacity: 0, y: -50 },
      animate: { opacity: 1, y: 0 },
      transition: { 
        type: "spring", 
        bounce: 0.6,
        delay: index * 0.1
      }
    },
    glow: {
      initial: { opacity: 0, textShadow: "0 0 0px rgba(59, 130, 246, 0)" },
      animate: { 
        opacity: 1, 
        textShadow: "0 0 10px rgba(59, 130, 246, 0.8)"
      },
      transition: { 
        duration: 0.6,
        delay: index * 0.1
      }
    }
  };

  return (
    <motion.span
      className="inline-block mr-2"
      {...effects[comicEffect]}
    >
      {word}
    </motion.span>
  );
}

interface AnimatedTextProps {
  text: string;
  className?: string;
  comicEffect?: 'pop' | 'zoom' | 'bounce' | 'glow';
  staggerDelay?: number;
}

export function AnimatedText({ 
  text, 
  className = '', 
  comicEffect = 'pop',
  staggerDelay = 0.1 
}: AnimatedTextProps) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, index) => (
        <AnimatedWord 
          key={index} 
          word={word} 
          index={index} 
          comicEffect={comicEffect}
        />
      ))}
    </span>
  );
}