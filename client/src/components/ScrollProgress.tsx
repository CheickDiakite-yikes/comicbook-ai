import { motion } from 'framer-motion';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface ScrollProgressProps {
  className?: string;
  showPercentage?: boolean;
  comicStyle?: boolean;
}

export function ScrollProgress({ 
  className = '', 
  showPercentage = false, 
  comicStyle = true 
}: ScrollProgressProps) {
  const { scrollProgress } = useScrollAnimation();

  if (comicStyle) {
    return (
      <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
        {/* Comic book style progress bar */}
        <div className="relative h-2 bg-black border-b-2 border-black">
          {/* Yellow base (classic comic book color) */}
          <div className="absolute inset-0 bg-yellow-400" />
          
          {/* Progress fill with comic book gradient */}
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden"
            initial={{ width: "0%" }}
            animate={{ width: `${scrollProgress * 100}%` }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            {/* Comic book halftone pattern overlay */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle, black 1px, transparent 1px)`,
                backgroundSize: '4px 4px'
              }}
            />
            
            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
          
          {/* Comic book style notches */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 border-r border-black"
                style={{ borderRightWidth: i === 9 ? 0 : '1px' }}
              />
            ))}
          </div>
        </div>
        
        {/* Comic book speech bubble with percentage */}
        {showPercentage && scrollProgress > 0.05 && (
          <motion.div
            className="absolute top-4 right-4"
            initial={{ opacity: 0, scale: 0, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "backOut" }}
          >
            <div className="relative bg-white border-4 border-black rounded-xl px-3 py-2 font-bold text-black">
              {Math.round(scrollProgress * 100)}%
              {/* Speech bubble pointer */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black" />
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-white" />
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Simple progress bar fallback
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-1 bg-muted ${className}`}>
      <motion.div
        className="h-full bg-primary"
        initial={{ width: "0%" }}
        animate={{ width: `${scrollProgress * 100}%` }}
        transition={{ duration: 0.1, ease: "easeOut" }}
      />
    </div>
  );
}