import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Wand2, Users } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";
import { motion } from "framer-motion";
import { ParticleSystem } from "@/components/ParticleSystem";
import { ScrollProgress } from "@/components/ScrollProgress";
import { TypewriterText, AnimatedText } from "@/components/TypewriterText";
import { MagicalBackground } from "@/components/MagicalBackground";
import { ComicPanel, ComicSpeechBubble } from "@/components/ComicPanel";
import { ComicBurst, ComicWOW, ComicZAP, ComicNEW } from "@/components/ComicBurst";
import { TheaterStage, MarqueeHeading } from "@/components/TheaterStage";
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
            <img 
              src={kumayiriLogo} 
              alt="Kumayiri Logo" 
              className="w-8 h-8 flex-shrink-0" 
              aria-hidden="true" 
            />
            <h1 className="text-lg sm:text-xl font-serif font-bold text-primary truncate">Kumayiri</h1>
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
              onClick={() => window.location.href = '/api/auth/google'}
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
                  onClick={() => window.location.href = '/login'}
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
                  onClick={() => window.location.href = '/login'}
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
                    <Wand2 className="h-8 w-8 text-white" aria-hidden="true" />
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
                  title="Kumayiri Demo - AI-Powered Comic Creation Platform"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
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
      {/* SEO-Optimized Footer */}
      <footer 
        className="bg-card border-t border-border py-8 sm:py-12" 
        style={{ paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
        role="contentinfo"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Footer Content Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            
            {/* Company Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/about" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-about"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a 
                    href="/explore" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-explore"
                  >
                    Explore Comics
                  </a>
                </li>
                <li>
                  <a 
                    href="mailto:hello@kumayiri.com" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-contact"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Create</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/api/auth/google" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-get-started"
                  >
                    Get Started Free
                  </a>
                </li>
                <li>
                  <a 
                    href="/templates" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-templates"
                  >
                    Templates
                  </a>
                </li>
                <li>
                  <a 
                    href="/characters" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-characters"
                  >
                    Character Library
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/privacy" 
                    rel="nofollow"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-privacy"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a 
                    href="/terms" 
                    rel="nofollow"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-terms"
                  >
                    Terms & Conditions
                  </a>
                </li>
              </ul>
            </div>

            {/* Brand & Contact */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Kumayiri</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                AI-powered comic creation platform. Bring your stories to life with the Story Bible system.
              </p>
              <div className="flex space-x-4">
                <a 
                  href="https://github.com/kumayiri" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="GitHub"
                  data-testid="link-github"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
                <a 
                  href="https://twitter.com/kumayiri" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Twitter"
                  data-testid="link-twitter"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-border pt-6 text-center">
            <p className="text-muted-foreground text-sm mb-2">
              © 2025 Kumayiri. All rights reserved.
            </p>
            <p className="text-muted-foreground text-xs">
              Built for the Nano Banana Hackathon • Powered by AI • Made with ❤️
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
