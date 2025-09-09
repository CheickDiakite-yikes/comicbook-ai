import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, AlertTriangle, CheckCircle, FileText, Mail, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { ComicPanel } from "@/components/ComicPanel";
import { ComicBurst, ComicWOW } from "@/components/ComicBurst";
import { MagicalBackground } from "@/components/MagicalBackground";
import { animationVariants } from "@/lib/animations";
import kumayiriLogo from "@assets/ChatGPT Image Sep 8, 2025, 08_35_18 PM_1757378183961.png";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* SEO Meta Tags */}
      <title>Terms & Conditions - Kumayiri | User Agreement & Guidelines</title>
      
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
          <ComicBurst className="mx-auto mb-6">LEGAL!</ComicBurst>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Terms & Conditions
          </h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-3xl mx-auto">
            The rules and guidelines for using Kumayiri. By using our platform, you agree to these terms.
          </p>
          <p className="text-sm text-muted-foreground">
            <Calendar className="inline h-4 w-4 mr-1" />
            Last updated: September 8, 2025
          </p>
        </motion.section>

        {/* Quick Summary */}
        <motion.section 
          className="mb-12"
          initial="hidden"
          animate="visible"
          variants={animationVariants.slideUp}
        >
          <ComicPanel panelStyle="modern" className="max-w-3xl mx-auto">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scale className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Key Points</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div>
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">Fair Use</p>
                  <p className="text-sm text-muted-foreground">Use responsibly</p>
                </div>
                <div>
                  <FileText className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <p className="font-medium">Content Rights</p>
                  <p className="text-sm text-muted-foreground">You own your comics</p>
                </div>
                <div>
                  <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <p className="font-medium">Prohibited</p>
                  <p className="text-sm text-muted-foreground">No harmful content</p>
                </div>
              </div>
            </CardContent>
          </ComicPanel>
        </motion.section>

        {/* Main Terms Sections */}
        <div className="space-y-8">
          
          {/* Acceptance of Terms */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                Acceptance of Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                By accessing and using Kumayiri, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
              <p className="text-muted-foreground">
                If you do not agree to abide by these terms, please do not use this service.
              </p>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">User Accounts & Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Account Creation</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• You must provide accurate and complete information</li>
                  <li>• You are responsible for maintaining account security</li>
                  <li>• One account per person, no sharing credentials</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Acceptable Use</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Use the service for lawful purposes only</li>
                  <li>• Respect intellectual property rights</li>
                  <li>• Do not attempt to hack or disrupt the service</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Content & Intellectual Property */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <FileText className="h-5 w-5 mr-2 text-blue-500" />
                Content & Intellectual Property
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Your Content Rights</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  You retain all rights to the comics, characters, and stories you create using Kumayiri.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• You own your original creative content</li>
                  <li>• You control who can view your public comics</li>
                  <li>• You can export and use your content elsewhere</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">AI-Generated Content</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Content generated by our AI systems based on your prompts:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• You have usage rights to AI-generated images</li>
                  <li>• Images are created based on your creative direction</li>
                  <li>• Similar images may be generated for other users</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Prohibited Content */}
          <Card className="border-2 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center text-xl text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Prohibited Content & Conduct
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The following types of content and conduct are strictly prohibited:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Harmful Content</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hate speech or discrimination</li>
                    <li>• Violence or threats</li>
                    <li>• Harassment or bullying</li>
                    <li>• Adult or inappropriate content</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Illegal Activities</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Copyright infringement</li>
                    <li>• Spam or malicious content</li>
                    <li>• Impersonation or fraud</li>
                    <li>• Violation of local laws</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Availability */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">Service Availability & Modifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Beta Service</h4>
                <p className="text-sm text-muted-foreground">
                  Kumayiri is currently in beta. We may modify, suspend, or discontinue any part of the service 
                  at any time with reasonable notice.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Updates & Changes</h4>
                <p className="text-sm text-muted-foreground">
                  We reserve the right to update these terms. Continued use of the service constitutes 
                  acceptance of revised terms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Kumayiri is provided "as is" without warranties of any kind. We are not liable for:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Service interruptions or downtime</li>
                <li>• Loss of data or content</li>
                <li>• Third-party integrations or services</li>
                <li>• Indirect or consequential damages</li>
              </ul>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">Account Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">By You</h4>
                <p className="text-sm text-muted-foreground">
                  You may terminate your account at any time by deleting your account in settings.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">By Us</h4>
                <p className="text-sm text-muted-foreground">
                  We may terminate accounts that violate these terms or for other legitimate business reasons.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-xl">Governing Law & Disputes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                These terms are governed by the laws of the jurisdiction where Kumayiri operates.
              </p>
              <p className="text-sm text-muted-foreground">
                Any disputes will be resolved through arbitration or the appropriate legal channels.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <ComicPanel panelStyle="action" className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <ComicWOW className="mx-auto mb-4 scale-75">HELP!</ComicWOW>
              <h3 className="text-xl font-bold mb-4">Questions About These Terms?</h3>
              <p className="text-muted-foreground mb-6">
                Need clarification or have concerns about these terms? We're here to help.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.location.href = 'mailto:legal@kumayiri.com'}
                data-testid="button-contact-legal"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Legal Team
              </Button>
            </CardContent>
          </ComicPanel>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 Kumayiri. These terms protect both you and our platform.
          </p>
        </div>
      </footer>
    </div>
  );
}