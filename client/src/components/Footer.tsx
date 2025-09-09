import React from 'react';

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  return (
    <footer 
      className={`bg-card border-t border-border py-8 sm:py-12 ${className}`}
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

          {/* Create Links */}
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
                  href="/explore" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-explore-inspiration"
                >
                  Find Inspiration
                </a>
              </li>
              <li>
                <a 
                  href="/api/auth/google" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-create-comic"
                >
                  Create Your Comic
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
  );
}