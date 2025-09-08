// Animation variants and utilities for Nerrame

export const animationVariants = {
  // Fade in animations
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },

  // Slide animations
  slideUp: {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },

  slideDown: {
    hidden: { opacity: 0, y: -50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },

  slideLeft: {
    hidden: { opacity: 0, x: 50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },

  slideRight: {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  },

  // Scale animations
  scaleIn: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  },

  // Comic book style animations
  comicZoom: {
    hidden: { opacity: 0, scale: 0.5, rotate: -5 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      rotate: 0,
      transition: { 
        duration: 0.7, 
        ease: "backOut",
        scale: { type: "spring", stiffness: 100 }
      }
    }
  },

  comicPop: {
    hidden: { opacity: 0, scale: 0 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: "spring",
        stiffness: 200,
        damping: 10,
        duration: 0.6
      }
    }
  },

  // Typewriter effect
  typewriter: {
    hidden: { width: 0 },
    visible: { 
      width: "auto",
      transition: { 
        duration: 2,
        ease: "linear"
      }
    }
  },

  // Floating animation
  float: {
    initial: { y: 0 },
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },

  // Stagger container
  staggerContainer: {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },

  // Hover animations
  hover: {
    scale: 1.05,
    transition: { duration: 0.2, ease: "easeOut" }
  },

  hoverGlow: {
    scale: 1.05,
    boxShadow: "0 10px 30px rgba(59, 130, 246, 0.3)",
    transition: { duration: 0.2 }
  },

  // Magic sparkle effect (for later use with SVG)
  sparkle: {
    hidden: { opacity: 0, scale: 0, rotate: 0 },
    visible: { 
      opacity: [0, 1, 0], 
      scale: [0, 1, 0], 
      rotate: 360,
      transition: { 
        duration: 1.5,
        times: [0, 0.5, 1],
        repeat: Infinity,
        repeatDelay: 2
      }
    }
  }
};

// Easing functions
export const easings = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  elastic: [0.68, -0.55, 0.265, 1.55]
};

// Animation durations
export const durations = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
  slowest: 1.2
};

// Utility function to create staggered animations
export const createStaggerAnimation = (children: number, delay = 0.1) => ({
  visible: {
    transition: {
      staggerChildren: delay,
      delayChildren: 0.2
    }
  }
});

// Utility function for scroll-triggered animations
export const createScrollAnimation = (yOffset = 50) => ({
  hidden: { opacity: 0, y: yOffset },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
});

// Comic book sound effects (for later text animations)
export const comicSounds = [
  "POW!",
  "BAM!", 
  "ZAP!",
  "BOOM!",
  "WOW!",
  "AMAZING!",
  "FANTASTIC!",
  "INCREDIBLE!"
];

// Check if user prefers reduced motion
export const shouldReduceMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Create motion-safe variants that respect user preferences
export const createMotionSafeVariant = (variant: any) => {
  if (shouldReduceMotion()) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } }
    };
  }
  return variant;
};