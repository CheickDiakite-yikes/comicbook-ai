import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, BookOpen, Wand2, Users } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { motion } from "framer-motion";
import { ParticleSystem } from "@/components/ParticleSystem";
import { ScrollProgress } from "@/components/ScrollProgress";
import { MagicalMascot } from "@/components/MagicalMascot";
import { TypewriterText, AnimatedText } from "@/components/TypewriterText";
import { MagicalBackground } from "@/components/MagicalBackground";
import { ComicPanel, ComicSpeechBubble } from "@/components/ComicPanel";
import { ComicBurst, ComicWOW, ComicZAP, ComicNEW } from "@/components/ComicBurst";
import { TheaterStage, MarqueeHeading, TheaterControls } from "@/components/TheaterStage";
import { ScrollStorytellingSection, StoryChapter } from "@/components/ScrollStorytellingSection";
import { MobileAwareComponent, TouchFriendlyButton, MobileOptimizedAnimation, MobileParticleSystem } from "@/components/MobileOptimizations";
import { PerformanceAnimation, LazyLoadWrapper, OptimizedParticleSystem } from "@/components/PerformanceOptimizations";
import { SkipLinks, AccessibleButton, ScreenReaderAnnouncement } from "@/components/AccessibilityEnhancements";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { animationVariants } from "@/lib/animations";

export default function Landing() {
  const heroSection = useIntersectionObserver({ threshold: 0.3 });
  const featuresSection = useIntersectionObserver({ threshold: 0.2 });
  const demoSection = useIntersectionObserver({ threshold: 0.3 });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* Skip links for accessibility */}
      <SkipLinks />
      {/* Enhanced magical background */}
      <MagicalBackground 
        density="medium" 
        theme="magical" 
        className="opacity-40"
      />
      
      {/* Optimized particle background */}
      <MobileAwareComponent
        mobileChildren={<MobileParticleSystem particleCount={8} className="opacity-30" />}
      >
        <OptimizedParticleSystem 
          particleCount={20}
          maxParticles={30}
          className="opacity-40"
        />
      </MobileAwareComponent>
      
      {/* Comic book style scroll progress */}
      <ScrollProgress comicStyle={true} showPercentage={false} />
      {/* Header with proper semantics */}
      <header role="banner">
        <nav 
          className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm"
          aria-label="Main navigation"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <Palette className="text-primary text-2xl" aria-hidden="true" />
            <h1 className="text-lg sm:text-xl font-serif font-bold text-primary truncate">Nerrame</h1>
            <span className="text-xs bg-chart-3 text-white px-2 py-1 rounded-full font-mono">Beta</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <Button 
              onClick={() => window.location.href = '/api/auth/google'}
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted min-h-[44px] text-xs sm:text-sm"
              data-testid="button-google-login"
              aria-label="Sign in with Google"
            >
              <FaGoogle className="h-4 w-4 text-red-500 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Google</span>
            </Button>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px] text-xs sm:text-sm"
              data-testid="button-replit-login"
              aria-label="Sign in with Replit"
            >
              <span className="hidden sm:inline">Sign In with</span> Replit
            </Button>
          </div>
        </nav>
      </header>
      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-20 relative z-10" role="main">
        {/* Hero Section with Animation */}
        <motion.div 
          ref={heroSection.ref}
          className="text-center mb-12 sm:mb-16 relative"
          initial="hidden"
          animate={heroSection.isIntersecting ? "visible" : "hidden"}
          variants={animationVariants.staggerContainer}
        >
          {/* Floating Mascot */}
          <motion.div
            className="absolute -top-16 left-8 sm:left-16 lg:left-32"
            variants={animationVariants.comicPop}
          >
            <MagicalMascot size="lg" interactive={true} />
          </motion.div>

          {/* Main title with typewriter effect */}
          <motion.div 
            className="font-serif font-bold mb-4 sm:mb-6 text-foreground relative" 
            style={{ fontSize: 'var(--text-hero)' }}
            variants={animationVariants.slideDown}
          >
            <AnimatedText 
              text="Create Amazing Comics with AI"
              comicEffect="glow"
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            />
            
            {/* Enhanced magic sparkles */}
            <motion.span
              className="absolute -top-4 -right-4 text-yellow-400 text-4xl"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ✨
            </motion.span>
            
            <motion.span
              className="absolute -top-8 left-4 text-blue-400 text-2xl"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 180, 360],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            >
              🌟
            </motion.span>
          </motion.div>
          {/* Subtitle with typewriter effect */}
          <motion.div 
            className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto"
            variants={animationVariants.slideUp}
          >
            <TypewriterText
              text="The ultimate comic creation platform powered by AI. Build your story bible once, then generate stunning comic pages while maintaining perfect character and style consistency."
              speed={30}
              delay={1000}
              className="leading-relaxed"
            />
          </motion.div>
          <motion.div 
            className="flex justify-center items-center"
            variants={animationVariants.slideUp}
          >
            <MobileAwareComponent
              mobileChildren={
                <TouchFriendlyButton
                  onClick={() => window.location.href = '/api/login'}
                  variant="primary"
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg w-full sm:w-auto"
                  hapticFeedback={true}
                >
                  <Wand2 className="mr-2 h-5 w-5" />
                  Get Started
                </TouchFriendlyButton>
              }
            >
              <motion.div
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)",
                  y: -5
                }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <Button 
                  size="lg"
                  onClick={() => window.location.href = '/api/login'}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground text-lg px-8 py-3 shadow-lg relative overflow-hidden"
                  data-testid="button-get-started"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                    animate={{
                      x: ['-100%', '100%']
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                  <motion.div
                    className="mr-2 h-5 w-5 relative z-10"
                    animate={{
                      rotate: [0, 15, -15, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Wand2 />
                  </motion.div>
                  <span className="relative z-10">Get Started</span>
                </Button>
                
                {/* Magic sparkles on hover */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  whileHover={{
                    opacity: 1
                  }}
                  initial={{ opacity: 0 }}
                >
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-yellow-400 text-lg"
                      style={{
                        left: `${20 + i * 20}%`,
                        top: `${20 + (i % 2) * 60}%`
                      }}
                      whileHover={{
                        scale: [0, 1, 0],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ delay: i * 0.1, duration: 0.6 }}
                    >
                      ✨
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </MobileAwareComponent>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <LazyLoadWrapper>
          <PerformanceAnimation
            className="mb-12 sm:mb-16"
            animationLevel="reduced"
          >
            <motion.section 
              ref={featuresSection.ref}
              className="feature-grid"
              aria-labelledby="features-heading"
              initial="hidden"
              animate="visible"
              variants={animationVariants.staggerContainer}
            >
          <h3 id="features-heading" className="sr-only">Platform Features</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Story Bible Panel */}
            <motion.div variants={animationVariants.comicZoom}>
              <ComicPanel 
                panelStyle="classic"
                soundEffect="AMAZING!"
                bgPattern="dots"
                className="h-full"
              >
                <CardContent className="p-6 text-center relative">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 border-2 border-black shadow-lg"
                    whileHover={{
                      rotate: [0, -10, 10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <BookOpen className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                  
                  <h3 className="font-bold text-lg mb-2 text-black">Story Bible</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Define characters, settings, and rules once. AI remembers everything.
                  </p>
                  
                  {/* Comic speech bubble tooltip */}
                  <div className="mt-4">
                    <ComicSpeechBubble
                      text="ONE & DONE!"
                      variant="speech"
                      color="bg-yellow-200"
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </ComicPanel>
            </motion.div>

            {/* AI Generation Panel */}
            <motion.div variants={animationVariants.comicZoom}>
              <ComicPanel 
                panelStyle="action"
                soundEffect="ZAP!"
                bgPattern="lines"
                className="h-full"
              >
                <CardContent className="p-6 text-center relative">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 border-2 border-black shadow-lg relative"
                    whileHover={{
                      rotate: [0, 15, -15, 0],
                      scale: 1.1
                    }}
                    transition={{ duration: 0.6 }}
                  >
                    <Wand2 className="h-8 w-8 text-white" aria-hidden="true" />
                    {/* Magic sparkles */}
                    <motion.div
                      className="absolute -top-2 -right-2 text-yellow-400 text-lg"
                      animate={{
                        scale: [0, 1, 0],
                        rotate: [0, 180, 360]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      ✨
                    </motion.div>
                  </motion.div>
                  
                  <h3 className="font-bold text-lg mb-2 text-black">AI Generation</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Generate panels individually or entire pages with context awareness.
                  </p>
                  
                  <div className="mt-4">
                    <ComicZAP className="mx-auto scale-75" />
                  </div>
                </CardContent>
              </ComicPanel>
            </motion.div>

            {/* Character Consistency Panel */}
            <motion.div variants={animationVariants.comicZoom}>
              <ComicPanel 
                panelStyle="modern"
                soundEffect="WOW!"
                bgPattern="solid"
                className="h-full"
              >
                <CardContent className="p-6 text-center relative">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4 border-2 border-black shadow-lg"
                    whileHover={{
                      scale: [1, 1.2, 1],
                      boxShadow: ["0 0 0 rgba(239, 68, 68, 0)", "0 0 20px rgba(239, 68, 68, 0.6)", "0 0 0 rgba(239, 68, 68, 0)"]
                    }}
                    transition={{ duration: 0.8 }}
                  >
                    <Users className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                  
                  <h3 className="font-bold text-lg mb-2 text-black">Character Consistency</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Characters look the same across all panels with advanced AI memory.
                  </p>
                  
                  <div className="mt-4">
                    <ComicSpeechBubble
                      text="PERFECT!"
                      variant="shout"
                      tailDirection="top-right"
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </ComicPanel>
            </motion.div>

            {/* Multiple Styles Panel */}
            <motion.div variants={animationVariants.comicZoom}>
              <ComicPanel 
                panelStyle="thought"
                soundEffect="CREATIVE!"
                bgPattern="dots"
                className="h-full"
              >
                <CardContent className="p-6 text-center relative">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 border-2 border-black shadow-lg"
                    whileHover={{
                      rotate: [0, 360],
                      background: [
                        "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                        "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                        "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                        "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
                      ]
                    }}
                    transition={{ duration: 2 }}
                  >
                    <Palette className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                  
                  <h3 className="font-bold text-lg mb-2 text-black">Multiple Styles</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    From manga to western comics, choose your perfect art style.
                  </p>
                  
                  <div className="mt-4 flex justify-center space-x-2">
                    <ComicNEW className="scale-75" />
                    <ComicWOW className="scale-75" />
                  </div>
                </CardContent>
              </ComicPanel>
            </motion.div>
          </div>
            </motion.section>
          </PerformanceAnimation>
        </LazyLoadWrapper>

        {/* Theater Demo Section */}
        <motion.section 
          ref={demoSection.ref}
          className="text-center" 
          aria-labelledby="demo-heading"
          initial="hidden"
          animate={demoSection.isIntersecting ? "visible" : "hidden"}
          variants={animationVariants.fadeIn}
        >
          {/* Marquee heading */}
          <motion.div
            className="mb-8"
            variants={animationVariants.slideDown}
          >
            <MarqueeHeading 
              text="✨ NOW SHOWING ✨"
              className="mb-4"
            />
            <motion.p
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
              variants={animationVariants.slideUp}
            >
              Step into the magic of AI-powered comic creation. Watch the full demo experience!
            </motion.p>
          </motion.div>

          {/* Theater stage with video */}
          <motion.div 
            variants={animationVariants.scaleIn}
            className="max-w-4xl mx-auto"
          >
            <TheaterStage 
              showCurtains={true}
              curtainDelay={1000}
              spotlightEffect={true}
              className="shadow-2xl"
            >
              <div className="aspect-video rounded-lg overflow-hidden">
                <iframe
                  src="https://www.youtube.com/embed/4XulgZqOhEw"
                  title="Nerrame Demo - AI-Powered Comic Creation Platform"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              
              {/* Theater controls */}
              <div className="mt-6 flex justify-center">
                <TheaterControls />
              </div>
            </TheaterStage>
          </motion.div>

          {/* Additional theater atmosphere */}
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 4 }}
          >
            <p className="text-sm text-muted-foreground mb-2">
              🎭 Experience the magic of storytelling
            </p>
            <a 
              href="https://youtu.be/4XulgZqOhEw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary hover:text-primary/80 text-sm underline font-medium"
            >
              Watch Full Show on YouTube →
            </a>
          </motion.div>
        </motion.section>

        {/* Scroll Storytelling Chapters */}
        <LazyLoadWrapper rootMargin="100px">
          <div className="mt-20 space-y-16" role="region" aria-label="Story chapters">
            <StoryChapter
              chapterNumber={1}
              title="Create Your Universe"
              theme="hero"
              content={
                <div className="space-y-4">
                  <p className="text-lg leading-relaxed">
                    Every great comic begins with a world. Define your characters, settings, and rules once in your Story Bible.
                  </p>
                  <div className="flex items-center space-x-4 text-sm" role="list" aria-label="Features">
                    <span className="bg-blue-600 px-3 py-1 rounded-full" role="listitem">Characters</span>
                    <span className="bg-purple-600 px-3 py-1 rounded-full" role="listitem">Settings</span>
                    <span className="bg-indigo-600 px-3 py-1 rounded-full" role="listitem">Art Style</span>
                  </div>
                </div>
              }
            />

          <StoryChapter
            chapterNumber={2}
            title="AI Brings Stories to Life"
            theme="action"
            content={
              <div className="space-y-4">
                <p className="text-lg leading-relaxed">
                  Watch as AI generates stunning comic panels that maintain perfect consistency with your vision.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-red-800/50 p-3 rounded">⚡ Instant Generation</div>
                  <div className="bg-orange-800/50 p-3 rounded">🎨 Style Consistency</div>
                </div>
              </div>
            }
          />

          <StoryChapter
            chapterNumber={3}
            title="Share Your Epic"
            theme="adventure"
            content={
              <div className="space-y-4">
                <p className="text-lg leading-relaxed">
                  Publish your comic to the world! Share with the community and discover amazing stories from other creators.
                </p>
                <div className="text-center">
                  <span className="bg-green-600 px-6 py-2 rounded-full text-lg font-bold">
                    Join the Adventure! 🚀
                  </span>
                </div>
              </div>
            }
          />
          </div>
        </LazyLoadWrapper>
      </main>
      {/* Footer */}
      <footer 
        className="bg-card border-t border-border py-6 sm:py-8" 
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
        role="contentinfo"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-muted-foreground">
            Built for the Nano Banana Hackathon • Powered by AI • Made with ❤️
          </p>
        </div>
      </footer>
    </div>
  );
}
