import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ComicBurstProps {
  children: ReactNode;
  className?: string;
  burstStyle?: 'star' | 'explosion' | 'jagged' | 'circle';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function ComicBurst({
  children,
  className = '',
  burstStyle = 'star',
  color = '#FFD700',
  size = 'md',
  animate = true
}: ComicBurstProps) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-xs',
    md: 'w-24 h-24 text-sm',
    lg: 'w-32 h-32 text-base'
  };

  const StarBurst = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill={color}
      stroke="black"
      strokeWidth="2"
    >
      <path d="M50 5 L55 35 L85 35 L65 55 L75 85 L50 70 L25 85 L35 55 L15 35 L45 35 Z" />
    </svg>
  );

  const ExplosionBurst = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill={color}
      stroke="black"
      strokeWidth="2"
    >
      <path d="M50 10 L60 25 L80 20 L70 40 L90 50 L70 60 L80 80 L60 75 L50 90 L40 75 L20 80 L30 60 L10 50 L30 40 L20 20 L40 25 Z" />
    </svg>
  );

  const JaggedBurst = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill={color}
      stroke="black"
      strokeWidth="2"
    >
      <path d="M50 5 L65 15 L85 10 L75 30 L95 40 L80 50 L90 70 L70 65 L60 85 L50 70 L40 85 L30 65 L10 70 L20 50 L5 40 L25 30 L15 10 L35 15 Z" />
    </svg>
  );

  const CircleBurst = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      fill={color}
      stroke="black"
      strokeWidth="3"
    >
      <circle cx="50" cy="50" r="40" />
    </svg>
  );

  const getBurstComponent = () => {
    switch (burstStyle) {
      case 'star': return <StarBurst />;
      case 'explosion': return <ExplosionBurst />;
      case 'jagged': return <JaggedBurst />;
      case 'circle': return <CircleBurst />;
      default: return <StarBurst />;
    }
  };

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${sizeClasses[size]} ${className}`}
      initial={animate ? { scale: 0, rotate: -10 } : {}}
      animate={animate ? { scale: 1, rotate: 0 } : {}}
      whileHover={animate ? { 
        scale: 1.1, 
        rotate: [0, -5, 5, 0],
        boxShadow: "0 0 20px rgba(255, 215, 0, 0.6)"
      } : {}}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 10,
        rotate: { duration: 0.5 }
      }}
    >
      {/* Burst background */}
      <motion.div
        className="absolute inset-0"
        animate={animate ? {
          rotate: [0, 360]
        } : {}}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        {getBurstComponent()}
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-center font-bold text-black p-2">
        {children}
      </div>

      {/* Sparkle effects */}
      {animate && (
        <>
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-white text-xs pointer-events-none"
              style={{
                left: `${20 + i * 20}%`,
                top: `${20 + (i % 2) * 60}%`
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                rotate: [0, 180, 360]
              }}
              transition={{
                duration: 2,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ✨
            </motion.div>
          ))}
        </>
      )}
    </motion.div>
  );
}

// Preset comic burst components for common use cases
export function ComicPOW({ className = '' }: { className?: string }) {
  return (
    <ComicBurst 
      burstStyle="explosion" 
      color="#FF6B6B" 
      size="lg" 
      className={className}
    >
      POW!
    </ComicBurst>
  );
}

export function ComicWOW({ className = '' }: { className?: string }) {
  return (
    <ComicBurst 
      burstStyle="star" 
      color="#4ECDC4" 
      size="md" 
      className={className}
    >
      WOW!
    </ComicBurst>
  );
}

export function ComicZAP({ className = '' }: { className?: string }) {
  return (
    <ComicBurst 
      burstStyle="jagged" 
      color="#FFE66D" 
      size="md" 
      className={className}
    >
      ZAP!
    </ComicBurst>
  );
}

export function ComicNEW({ className = '' }: { className?: string }) {
  return (
    <ComicBurst 
      burstStyle="circle" 
      color="#A8E6CF" 
      size="sm" 
      className={className}
    >
      NEW!
    </ComicBurst>
  );
}