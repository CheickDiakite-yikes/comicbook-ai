import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface TheaterStageProps {
  children: ReactNode;
  className?: string;
  showCurtains?: boolean;
  curtainDelay?: number;
  spotlightEffect?: boolean;
}

export function TheaterStage({
  children,
  className = '',
  showCurtains = true,
  curtainDelay = 2000,
  spotlightEffect = true
}: TheaterStageProps) {
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurtainsOpen(true);
      if (spotlightEffect) {
        setShowSpotlight(true);
      }
    }, curtainDelay);

    return () => clearTimeout(timer);
  }, [curtainDelay, spotlightEffect]);

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      {/* Theater floor */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-800 to-gray-700"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
        }}
      />

      {/* Spotlight effects */}
      {spotlightEffect && showSpotlight && (
        <>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {/* Main spotlight */}
            <div 
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 60% 40% at 50% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 70%)`
              }}
            />
            
            {/* Side spotlights */}
            <motion.div 
              className="absolute inset-0"
              animate={{
                background: [
                  `radial-gradient(ellipse 30% 50% at 20% 20%, rgba(255, 215, 0, 0.05) 0%, transparent 60%)`,
                  `radial-gradient(ellipse 30% 50% at 80% 20%, rgba(255, 215, 0, 0.05) 0%, transparent 60%)`,
                  `radial-gradient(ellipse 30% 50% at 20% 20%, rgba(255, 215, 0, 0.05) 0%, transparent 60%)`
                ]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        </>
      )}

      {/* Stage content */}
      <div className="relative z-10 p-6">
        {children}
      </div>

      {/* Theater curtains */}
      <AnimatePresence>
        {showCurtains && (
          <>
            {/* Left curtain */}
            <motion.div
              className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-red-800 to-red-600 z-20"
              initial={{ x: 0 }}
              animate={{ x: curtainsOpen ? '-100%' : 0 }}
              exit={{ x: '-100%' }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                delay: curtainsOpen ? 0 : 0.5
              }}
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)`
              }}
            >
              {/* Curtain texture */}
              <div className="absolute inset-0 bg-gradient-to-b from-red-700 to-red-900 opacity-30" />
              
              {/* Curtain folds */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-0 bottom-0 w-2 bg-red-900 opacity-40"
                  style={{ left: `${i * 16}%` }}
                  animate={{
                    scaleX: [1, 1.2, 1],
                    opacity: [0.4, 0.6, 0.4]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </motion.div>

            {/* Right curtain */}
            <motion.div
              className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-800 to-red-600 z-20"
              initial={{ x: 0 }}
              animate={{ x: curtainsOpen ? '100%' : 0 }}
              exit={{ x: '100%' }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                delay: curtainsOpen ? 0 : 0.5
              }}
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)`
              }}
            >
              {/* Curtain texture */}
              <div className="absolute inset-0 bg-gradient-to-b from-red-700 to-red-900 opacity-30" />
              
              {/* Curtain folds */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-0 bottom-0 w-2 bg-red-900 opacity-40"
                  style={{ right: `${i * 16}%` }}
                  animate={{
                    scaleX: [1, 1.2, 1],
                    opacity: [0.4, 0.6, 0.4]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </motion.div>

            {/* Curtain rod */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-yellow-600 to-yellow-800 z-30">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-500 opacity-50" />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Theater lights around the frame */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 bg-yellow-400 rounded-full border border-yellow-600"
            style={{
              left: `${(i * 8.33) + 4}%`,
              top: i % 2 === 0 ? '4px' : 'auto',
              bottom: i % 2 === 1 ? '4px' : 'auto'
            }}
            animate={{
              opacity: [0.4, 1, 0.4],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface MarqueeHeadingProps {
  text: string;
  className?: string;
  lightColor?: string;
  speed?: number;
}

export function MarqueeHeading({
  text,
  className = '',
  lightColor = '#FFD700',
  speed = 3000
}: MarqueeHeadingProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Main marquee background */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-4 border-yellow-600 rounded-lg p-4 shadow-2xl">
        {/* Scrolling lights background */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${lightColor}20 50%, transparent 100%)`
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%']
          }}
          transition={{
            duration: speed / 1000,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        {/* Text content */}
        <h2 className="relative z-10 text-center font-bold text-2xl sm:text-4xl text-white">
          {text.split('').map((letter, index) => (
            <motion.span
              key={index}
              className="inline-block"
              style={{
                textShadow: `0 0 10px ${lightColor}, 0 0 20px ${lightColor}, 0 0 30px ${lightColor}`
              }}
              animate={{
                textShadow: [
                  `0 0 5px ${lightColor}`,
                  `0 0 15px ${lightColor}, 0 0 25px ${lightColor}`,
                  `0 0 5px ${lightColor}`
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: index * 0.1,
                ease: "easeInOut"
              }}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </motion.span>
          ))}
        </h2>
        
        {/* Bulb lights around the border */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full border border-yellow-600"
              style={{
                background: lightColor,
                left: `${(i * 5) + 2.5}%`,
                top: i % 2 === 0 ? '-4px' : 'auto',
                bottom: i % 2 === 1 ? '-4px' : 'auto'
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8],
                boxShadow: [
                  `0 0 5px ${lightColor}`,
                  `0 0 15px ${lightColor}`,
                  `0 0 5px ${lightColor}`
                ]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface VideoControlsProps {
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  isPlaying?: boolean;
  volume?: number;
}

export function TheaterControls({
  className = '',
  onPlay,
  onPause,
  onVolumeChange,
  isPlaying = false,
  volume = 1
}: VideoControlsProps) {
  return (
    <motion.div
      className={`flex items-center justify-center space-x-4 bg-gray-900 rounded-full px-6 py-3 border-2 border-yellow-600 ${className}`}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 3, duration: 0.5 }}
    >
      {/* Play/Pause button */}
      <motion.button
        className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center text-black font-bold"
        onClick={isPlaying ? onPause : onPlay}
        whileHover={{ scale: 1.1, boxShadow: "0 0 20px #FFD700" }}
        whileTap={{ scale: 0.95 }}
      >
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
      </motion.button>

      {/* Volume control */}
      <div className="flex items-center space-x-2">
        <Volume2 className="w-5 h-5 text-yellow-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
          className="w-20 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
          }}
        />
      </div>

      
    </motion.div>
  );
}