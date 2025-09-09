import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Heart, Zap, Users, BookOpen, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ComicPanel, ComicSpeechBubble } from "@/components/ComicPanel";
import { ComicBurst, ComicWOW, ComicZAP, ComicNEW } from "@/components/ComicBurst";
import { MagicalBackground } from "@/components/MagicalBackground";
import { PerformanceAnimation, LazyLoadWrapper } from "@/components/PerformanceOptimizations";
import { MobileAwareComponent, MobileParticleSystem } from "@/components/MobileOptimizations";
import { animationVariants } from "@/lib/animations";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";

export default function About() {

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* SEO Meta Tags handled by main HTML */}
      <title>About Kumayiri - AI-Powered Comic Creation Platform | Our Story</title>
      
      {/* Enhanced magical background */}
      <MagicalBackground 
        density="medium" 
        theme="magical" 
        className="opacity-30"
      />
      
      {/* Optimized particle background */}
      <MobileAwareComponent
        mobileChildren={<MobileParticleSystem particleCount={6} className="opacity-20" />}
      >
        <MobileParticleSystem 
          particleCount={15}
          className="opacity-30"
        />
      </MobileAwareComponent>

      {/* Header Navigation */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center space-x-2 min-w-0">
          <img 
            src={kumayiriLogo} 
            alt="Kumayiri Logo" 
            className="w-8 h-8 flex-shrink-0" 
          />
          <h1 className="text-lg sm:text-xl font-serif font-bold text-primary truncate">Kumayiri</h1>
          <Badge variant="secondary" className="text-xs">Beta</Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            size="sm"
            data-testid="button-home"
          >
            Home
          </Button>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            size="sm"
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16 relative z-10">
        
        {/* Hero Section */}
        <motion.section 
          className="text-center mb-16"
          initial="hidden"
          animate="visible"
          variants={animationVariants.fadeIn}
        >
          <motion.div variants={animationVariants.slideDown}>
            <ComicBurst className="mx-auto mb-6">POW!</ComicBurst>
            <h1 className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Meet Kumayiri
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
              Born from the beautiful Bambara words <strong>"kuma"</strong> (word/speech) and <strong>"yiri"</strong> (tree/growth), 
              Kumayiri represents the growth of stories through AI-powered comic creation.
            </p>
          </motion.div>

          <motion.div variants={animationVariants.slideUp} className="mt-8">
            <ComicPanel panelStyle="action" className="max-w-2xl mx-auto">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
                <p className="text-lg leading-relaxed">
                  To democratize comic creation by empowering storytellers with AI tools that maintain 
                  artistic vision while eliminating technical barriers.
                </p>
              </CardContent>
            </ComicPanel>
          </motion.div>
        </motion.section>

        {/* Story Section */}
        <LazyLoadWrapper>
          <motion.section 
            className="mb-16"
            initial="hidden"
            animate="visible"
            variants={animationVariants.staggerContainer}
          >
            <motion.div variants={animationVariants.slideDown} className="text-center mb-12">
              <ComicZAP className="mx-auto mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Story</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                From concept to creation - the journey of building the ultimate comic creation platform
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              <motion.div variants={animationVariants.slideLeft}>
                <ComicPanel panelStyle="modern" soundEffect="IDEA!" bgPattern="dots">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mr-4">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">The Spark</h3>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      Every great comic starts with an idea, but bringing that vision to life has always been 
                      challenging. We saw talented storytellers struggling with the technical aspects of comic creation.
                    </p>
                  </CardContent>
                </ComicPanel>
              </motion.div>

              <motion.div variants={animationVariants.slideRight}>
                <ComicPanel panelStyle="thought" soundEffect="EUREKA!" bgPattern="lines">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">The Solution</h3>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      We created the "Story Bible" system - define your world once, then generate infinite 
                      consistent pages. AI handles the art while you focus on the story.
                    </p>
                  </CardContent>
                </ComicPanel>
              </motion.div>
            </div>
          </motion.section>
        </LazyLoadWrapper>

        {/* Values Section */}
        <LazyLoadWrapper>
          <motion.section 
            initial="hidden"
            animate="visible"
            variants={animationVariants.staggerContainer}
          >
            <motion.div variants={animationVariants.slideDown} className="text-center mb-12">
              <ComicWOW className="mx-auto mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Values</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                The principles that guide everything we build
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <motion.div variants={animationVariants.comicZoom}>
                <Card className="h-full border-2 border-black shadow-lg transform hover:scale-105 transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Heart className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Creator-First</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every feature is designed to empower creators, not replace them. 
                      AI amplifies your vision.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={animationVariants.comicZoom}>
                <Card className="h-full border-2 border-black shadow-lg transform hover:scale-105 transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Community Driven</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Built by creators, for creators. Your feedback shapes our roadmap 
                      and feature development.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={animationVariants.comicZoom}>
                <Card className="h-full border-2 border-black shadow-lg transform hover:scale-105 transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Palette className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Artistic Freedom</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Choose your style, set your tone. From manga to western comics, 
                      your artistic vision leads.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Call to Action */}
            <motion.div variants={animationVariants.slideUp} className="text-center mt-16">
              <ComicPanel panelStyle="action" className="max-w-lg mx-auto">
                <CardContent className="p-8 text-center">
                  <h3 className="text-xl font-bold mb-4">Ready to Join Our Story?</h3>
                  <p className="text-muted-foreground mb-6">
                    Be part of the comic creation revolution
                  </p>
                  <Button 
                    size="lg" 
                    onClick={() => window.location.href = '/api/login'}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    data-testid="button-get-started"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Started Free
                  </Button>
                </CardContent>
              </ComicPanel>
            </motion.div>
          </motion.section>
        </LazyLoadWrapper>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-muted-foreground">
            © 2024 Kumayiri. Building the future of comic creation with AI.
          </p>
        </div>
      </footer>
    </div>
  );
}