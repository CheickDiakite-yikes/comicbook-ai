import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, FileText, Mail, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { ComicPanel } from "@/components/ComicPanel";
import { ComicBurst, ComicWOW } from "@/components/ComicBurst";
import { MagicalBackground } from "@/components/MagicalBackground";
import { animationVariants } from "@/lib/animations";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* SEO Meta Tags */}
      <title>Privacy Policy - Kumayiri | Data Protection & User Rights</title>
      
      {/* Background */}
      <MagicalBackground 
        density="low" 
        theme="minimal" 
        className="opacity-20"
      />

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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 relative z-10">
        
        {/* Hero Section */}
        <motion.section 
          className="text-center mb-12"
          initial="hidden"
          animate="visible"
          variants={animationVariants.fadeIn}
        >
          <ComicBurst className="mx-auto mb-6">SECURE!</ComicBurst>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-3xl mx-auto">
            Your privacy matters to us. This policy explains how we collect, use, and protect your data.
          </p>
          <p className="text-sm text-muted-foreground">
            <Calendar className="inline h-4 w-4 mr-1" />
            Last updated: September 8, 2025
          </p>
        </motion.section>

        {/* Quick Overview */}
        <motion.section 
          className="mb-12"
          initial="hidden"
          animate="visible"
          variants={animationVariants.slideUp}
        >
          <ComicPanel panelStyle="modern" className="max-w-3xl mx-auto">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Your Rights at a Glance</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div>
                  <Eye className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <p className="font-medium">Access</p>
                  <p className="text-sm text-muted-foreground">View your data</p>
                </div>
                <div>
                  <FileText className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <p className="font-medium">Portability</p>
                  <p className="text-sm text-muted-foreground">Export your comics</p>
                </div>
                <div>
                  <Lock className="h-6 w-6 text-red-500 mx-auto mb-2" />
                  <p className="font-medium">Deletion</p>
                  <p className="text-sm text-muted-foreground">Delete your account</p>
                </div>
              </div>
            </CardContent>
          </ComicPanel>
        </motion.section>

        {/* Main Content Sections */}
        <div className="space-y-8">
          
          {/* Information We Collect */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <FileText className="h-5 w-5 mr-2 text-blue-500" />
                Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Account Information</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Email address (for authentication)</li>
                  <li>• Profile name and image (from OAuth providers)</li>
                  <li>• Account creation and last login dates</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Content You Create</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Comic projects, characters, and story elements</li>
                  <li>• Generated images and AI prompts</li>
                  <li>• Public comics you choose to share</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Usage Data</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Pages visited and features used</li>
                  <li>• Device and browser information</li>
                  <li>• IP address and general location</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Shield className="h-5 w-5 mr-2 text-green-500" />
                How We Use Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Service Provision</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Authenticate your account</li>
                    <li>• Generate AI comic content</li>
                    <li>• Save and sync your projects</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Platform Improvement</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Analyze usage patterns</li>
                    <li>• Fix bugs and improve performance</li>
                    <li>• Develop new features</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Protection */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Lock className="h-5 w-5 mr-2 text-purple-500" />
                How We Protect Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Technical Safeguards</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• HTTPS encryption in transit</li>
                    <li>• Database encryption at rest</li>
                    <li>• Secure authentication systems</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Access Controls</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Limited staff access</li>
                    <li>• Regular security audits</li>
                    <li>• Incident response procedures</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Eye className="h-5 w-5 mr-2 text-orange-500" />
                Your Rights & Choices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">Access & Portability</h4>
                  <p className="text-sm text-muted-foreground">
                    Request a copy of your personal data and export your comics at any time.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold">Correction & Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Update your profile information or correct inaccurate data through your account settings.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold">Deletion</h4>
                  <p className="text-sm text-muted-foreground">
                    Delete your account and all associated data. Note: Publicly shared comics may remain visible.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Third-Party Services */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold">Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  We use Replit and Google OAuth for secure authentication. These services have their own privacy policies.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">AI Services</h4>
                <p className="text-sm text-muted-foreground">
                  AI image generation is powered by Google's Gemini. Generated content is processed according to their terms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <ComicPanel panelStyle="action" className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <ComicWOW className="mx-auto mb-4 scale-75">CONTACT!</ComicWOW>
              <h3 className="text-xl font-bold mb-4">Questions About Privacy?</h3>
              <p className="text-muted-foreground mb-6">
                We're here to help! Contact us with any privacy-related questions or concerns.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.location.href = 'mailto:privacy@kumayiri.com'}
                data-testid="button-contact-privacy"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Privacy Team
              </Button>
            </CardContent>
          </ComicPanel>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 Kumayiri. Your privacy is protected by this policy and applicable laws.
          </p>
        </div>
      </footer>
    </div>
  );
}