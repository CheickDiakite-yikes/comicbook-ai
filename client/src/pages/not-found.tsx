import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-background px-4" 
      style={{ 
        paddingTop: 'var(--safe-top)', 
        paddingBottom: 'calc(1rem + var(--safe-bottom))' 
      }}
    >
      <main role="main" aria-labelledby="not-found-heading">
        <Card className="w-full max-w-md border-border">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
            </div>
            
            <h1 id="not-found-heading" className="text-xl sm:text-2xl font-bold mb-2">
              404 - Page Not Found
            </h1>

            <p className="mt-4 text-sm text-muted-foreground mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="space-y-3">
              <Link href="/">
                <Button 
                  className="w-full min-h-[44px]" 
                  data-testid="button-home"
                  aria-label="Go to home page"
                >
                  <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                  Go Home
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
                className="w-full min-h-[44px]"
                aria-label="Go back to previous page"
                data-testid="button-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
