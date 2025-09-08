import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

interface ScrollStorytellingProps {
  children: ReactNode;
  className?: string;
  parallaxIntensity?: number;
  revealDirection?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

export function ScrollStorytellingSection({
  children,
  className = '',
  parallaxIntensity = 0.5,
  revealDirection = 'up'
}: ScrollStorytellingProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const { ref: intersectionRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    triggerOnce: true
  });

  // Parallax transforms
  const y = useTransform(scrollYProgress, [0, 1], [0, -50 * parallaxIntensity]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1.2]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const getRevealVariant = () => {
    const distance = 100;
    switch (revealDirection) {
      case 'up':
        return {
          hidden: { opacity: 0, y: distance },
          visible: { opacity: 1, y: 0 }
        };
      case 'down':
        return {
          hidden: { opacity: 0, y: -distance },
          visible: { opacity: 1, y: 0 }
        };
      case 'left':
        return {
          hidden: { opacity: 0, x: distance },
          visible: { opacity: 1, x: 0 }
        };
      case 'right':
        return {
          hidden: { opacity: 0, x: -distance },
          visible: { opacity: 1, x: 0 }
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.5 },
          visible: { opacity: 1, scale: 1 }
        };
      default:
        return {
          hidden: { opacity: 0, y: distance },
          visible: { opacity: 1, y: 0 }
        };
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{ y }}
    >
      <motion.div
        ref={intersectionRef}
        initial="hidden"
        animate={isIntersecting ? "visible" : "hidden"}
        variants={getRevealVariant()}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ scale, opacity }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface StoryChapterProps {
  title: string;
  content: ReactNode;
  chapterNumber: number;
  className?: string;
  theme?: 'hero' | 'action' | 'mystery' | 'adventure';
}

export function StoryChapter({
  title,
  content,
  chapterNumber,
  className = '',
  theme = 'hero'
}: StoryChapterProps) {
  const themeColors = {
    hero: {
      bg: 'from-blue-900 to-purple-900',
      accent: 'text-blue-400',
      border: 'border-blue-500'
    },
    action: {
      bg: 'from-red-900 to-orange-900',
      accent: 'text-red-400',
      border: 'border-red-500'
    },
    mystery: {
      bg: 'from-purple-900 to-gray-900',
      accent: 'text-purple-400',
      border: 'border-purple-500'
    },
    adventure: {
      bg: 'from-green-900 to-teal-900',
      accent: 'text-green-400',
      border: 'border-green-500'
    }
  };

  const currentTheme = themeColors[theme];

  return (
    <ScrollStorytellingSection className={`py-16 ${className}`} revealDirection="up">
      <div className={`relative bg-gradient-to-br ${currentTheme.bg} rounded-2xl p-8 border-2 ${currentTheme.border} shadow-2xl`}>
        {/* Chapter number */}
        <motion.div
          className={`absolute -top-6 left-8 bg-gradient-to-r ${currentTheme.bg} ${currentTheme.border} border-2 rounded-full w-12 h-12 flex items-center justify-center font-bold text-white`}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          {chapterNumber}
        </motion.div>

        {/* Title */}
        <motion.h3
          className={`text-2xl font-bold ${currentTheme.accent} mb-4 ml-8`}
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {title}
        </motion.h3>

        {/* Content */}
        <motion.div
          className="text-white"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          {content}
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute top-4 right-4 opacity-20">
          <motion.div
            className={`text-4xl ${currentTheme.accent}`}
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {theme === 'hero' && '🦸'}
            {theme === 'action' && '⚡'}
            {theme === 'mystery' && '🔍'}
            {theme === 'adventure' && '🗺️'}
          </motion.div>
        </div>

        {/* Animated border glow */}
        <motion.div
          className={`absolute inset-0 rounded-2xl border-2 ${currentTheme.border} opacity-50`}
          animate={{
            boxShadow: [
              `0 0 20px ${currentTheme.border.replace('border-', '')}`,
              `0 0 40px ${currentTheme.border.replace('border-', '')}`,
              `0 0 20px ${currentTheme.border.replace('border-', '')}`
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </ScrollStorytellingSection>
  );
}

interface PageFlipEffectProps {
  children: ReactNode;
  className?: string;
  flipDirection?: 'horizontal' | 'vertical';
  flipTrigger?: 'scroll' | 'hover' | 'click';
}

export function PageFlipEffect({
  children,
  className = '',
  flipDirection = 'horizontal',
  flipTrigger = 'scroll'
}: PageFlipEffectProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"]
  });

  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    flipDirection === 'vertical' ? [90, 0, -90] : [0, 0, 0]
  );

  const rotateY = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    flipDirection === 'horizontal' ? [90, 0, -90] : [0, 0, 0]
  );

  return (
    <div ref={ref} className={`perspective-1000 ${className}`}>
      <motion.div
        className="relative preserve-3d"
        style={{
          rotateX: flipDirection === 'vertical' ? rotateX : 0,
          rotateY: flipDirection === 'horizontal' ? rotateY : 0
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}