import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaGoogle } from "react-icons/fa";
import { Wand2, ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { MagicalBackground } from "@/components/MagicalBackground";
import { ComicPanel } from "@/components/ComicPanel";
import { PerformanceAnimation } from "@/components/PerformanceOptimizations";
import { animationVariants } from "@/lib/animations";

export default function Login() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Magical background */}
      <MagicalBackground 
        density="light" 
        theme="magical" 
        className="opacity-30"
      />
      
      {/* Back to home link */}
      <motion.div
        className="absolute top-6 left-6 z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </motion.div>

      {/* Main login container */}
      <PerformanceAnimation className="w-full max-w-md px-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={animationVariants.staggerContainer}
          className="space-y-8"
        >
          {/* Header with title and subtitle */}
          <motion.div 
            className="text-center space-y-4"
            variants={animationVariants.slideDown}
          >
            <motion.div
              className="relative inline-block"
              whileHover={{ scale: 1.05 }}
            >
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Welcome to Nerrame
              </h1>
              
              {/* Floating sparkles */}
              <motion.div
                className="absolute -top-2 -right-2 text-yellow-400 text-2xl"
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
              </motion.div>
            </motion.div>
            
            <p className="text-muted-foreground text-lg">
              Choose your preferred way to sign in and start creating amazing comics with AI
            </p>
          </motion.div>

          {/* Login options */}
          <motion.div
            variants={animationVariants.slideUp}
            className="space-y-4"
          >
            <ComicPanel 
              panelStyle="modern"
              className="p-0 overflow-hidden"
            >
              <Card className="border-0 shadow-lg">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="flex items-center justify-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span>Sign In Options</span>
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Google Sign In */}
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      onClick={() => window.location.href = '/api/auth/google'}
                      size="lg"
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-lg py-6 shadow-lg border-2 border-red-800 relative overflow-hidden"
                      data-testid="button-google-signin"
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
                      <FaGoogle className="mr-3 h-6 w-6 relative z-10" />
                      <span className="relative z-10">Continue with Google</span>
                    </Button>
                  </motion.div>

                  {/* Divider */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-background px-4 text-muted-foreground font-medium">or</span>
                    </div>
                  </div>

                  {/* Replit Sign In */}
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      onClick={() => window.location.href = '/api/login'}
                      size="lg"
                      variant="outline"
                      className="w-full border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground text-lg py-6 bg-gradient-to-r from-transparent to-transparent hover:from-primary hover:to-primary transition-all duration-300 relative overflow-hidden"
                      data-testid="button-replit-signin"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent opacity-10"
                        animate={{
                          x: ['-100%', '100%']
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                      <motion.div
                        className="mr-3 h-6 w-6 relative z-10"
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
                      <span className="relative z-10">Continue with Replit</span>
                      
                      {/* Magic sparkles on hover */}
                      <motion.div
                        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100"
                        whileHover={{ opacity: 1 }}
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
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </ComicPanel>
          </motion.div>

          {/* Footer note */}
          <motion.div
            variants={animationVariants.fadeIn}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </motion.div>
        </motion.div>
      </PerformanceAnimation>
    </div>
  );
}