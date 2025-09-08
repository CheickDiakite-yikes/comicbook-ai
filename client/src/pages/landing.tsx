import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, BookOpen, Wand2, Users } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { motion } from "framer-motion";
import { ParticleSystem } from "@/components/ParticleSystem";
import { ScrollProgress } from "@/components/ScrollProgress";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { animationVariants } from "@/lib/animations";

export default function Landing() {
  const heroSection = useIntersectionObserver({ threshold: 0.3 });
  const featuresSection = useIntersectionObserver({ threshold: 0.2 });
  const demoSection = useIntersectionObserver({ threshold: 0.3 });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* Magical particle background */}
      <ParticleSystem 
        particleCount={30}
        interactive={true}
        className="opacity-60"
      />
      
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-20 relative z-10">
        {/* Hero Section with Animation */}
        <motion.div 
          ref={heroSection.ref}
          className="text-center mb-12 sm:mb-16"
          initial="hidden"
          animate={heroSection.isIntersecting ? "visible" : "hidden"}
          variants={animationVariants.staggerContainer}
        >
          <motion.h2 
            className="font-serif font-bold mb-4 sm:mb-6 text-foreground relative" 
            style={{ fontSize: 'var(--text-hero)' }}
            variants={animationVariants.slideDown}
          >
            Create Amazing Comics with AI
            {/* Magic sparkles effect */}
            <motion.span
              className="absolute -top-4 -right-4 text-yellow-400 text-2xl"
              variants={animationVariants.sparkle}
            >
              ✨
            </motion.span>
          </motion.h2>
          <motion.p 
            className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto"
            variants={animationVariants.slideUp}
          >
            The ultimate comic creation platform powered by AI. Build your story bible once, 
            then generate stunning comic pages while maintaining perfect character and style consistency.
          </motion.p>
          <motion.div 
            className="flex flex-col gap-4 justify-center items-center"
            variants={animationVariants.slideUp}
          >
            <motion.div
              whileHover={animationVariants.hoverGlow}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="lg"
                onClick={() => window.location.href = '/api/auth/google'}
                className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-3 shadow-lg"
                data-testid="button-get-started-google"
              >
                <FaGoogle className="mr-2 h-5 w-5" />
                Get Started with Google
              </Button>
            </motion.div>
            <motion.div 
              className="text-muted-foreground text-sm"
              variants={animationVariants.fadeIn}
            >
              or
            </motion.div>
            <motion.div
              whileHover={animationVariants.hover}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="lg"
                onClick={() => window.location.href = '/api/login'}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-lg px-8 py-3"
                data-testid="button-get-started-replit"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                Get Started with Replit
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.section 
          ref={featuresSection.ref}
          className="feature-grid mb-12 sm:mb-16"
          aria-labelledby="features-heading"
          initial="hidden"
          animate={featuresSection.isIntersecting ? "visible" : "hidden"}
          variants={animationVariants.staggerContainer}
        >
          <h3 id="features-heading" className="sr-only">Platform Features</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <motion.div variants={animationVariants.comicZoom}>
              <Card className="border-border hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6 text-center">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-chart-1 to-chart-2 rounded-xl flex items-center justify-center mx-auto mb-4"
                    whileHover={animationVariants.float.animate}
                  >
                    <BookOpen className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                <h3 className="font-semibold text-lg mb-2">Story Bible</h3>
                <p className="text-sm text-muted-foreground">
                  Define characters, settings, and rules once. AI remembers everything.
                </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={animationVariants.comicZoom}>
              <Card className="border-border hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6 text-center">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-chart-3 to-chart-4 rounded-xl flex items-center justify-center mx-auto mb-4"
                    whileHover={animationVariants.float.animate}
                  >
                    <Wand2 className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                <h3 className="font-semibold text-lg mb-2">AI Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Generate panels individually or entire pages with context awareness.
                </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={animationVariants.comicZoom}>
              <Card className="border-border hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6 text-center">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-chart-5 to-destructive rounded-xl flex items-center justify-center mx-auto mb-4"
                    whileHover={animationVariants.float.animate}
                  >
                    <Users className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                <h3 className="font-semibold text-lg mb-2">Character Consistency</h3>
                <p className="text-sm text-muted-foreground">
                  Characters look the same across all panels with advanced AI memory.
                </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={animationVariants.comicZoom}>
              <Card className="border-border hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6 text-center">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-chart-2 to-chart-1 rounded-xl flex items-center justify-center mx-auto mb-4"
                    whileHover={animationVariants.float.animate}
                  >
                    <Palette className="h-8 w-8 text-white" aria-hidden="true" />
                  </motion.div>
                <h3 className="font-semibold text-lg mb-2">Multiple Styles</h3>
                <p className="text-sm text-muted-foreground">
                  From manga to western comics, choose your perfect art style.
                </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* Demo Section */}
        <motion.section 
          ref={demoSection.ref}
          className="text-center" 
          aria-labelledby="demo-heading"
          initial="hidden"
          animate={demoSection.isIntersecting ? "visible" : "hidden"}
          variants={animationVariants.fadeIn}
        >
          <motion.h3 
            id="demo-heading" 
            className="text-2xl sm:text-3xl font-serif font-bold mb-6 sm:mb-8"
            variants={animationVariants.slideUp}
          >
            See It In Action
          </motion.h3>
          <motion.div 
            className="bg-card rounded-xl border border-border p-4 sm:p-8"
            variants={animationVariants.scaleIn}
          >
            <div className="aspect-video rounded-lg overflow-hidden border border-border">
              <iframe
                src="https://www.youtube.com/embed/4XulgZqOhEw"
                title="Nerrame Demo - AI-Powered Comic Creation Platform"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Watch how easy it is to create comics with AI assistance
              </p>
              <a 
                href="https://youtu.be/4XulgZqOhEw" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary hover:text-primary/80 text-sm mt-2 underline"
              >
                Watch on YouTube
              </a>
            </div>
          </motion.div>
        </motion.section>
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
