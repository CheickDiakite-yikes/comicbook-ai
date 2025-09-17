import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Clock, RefreshCw } from 'lucide-react';
import { useQuotaNotification } from '@/contexts/QuotaNotificationContext';

export function QuotaNotificationBanner() {
  const { state, clearQuotaError, dismissTemporarily, isCurrentlyVisible } = useQuotaNotification();
  const [isExpanded, setIsExpanded] = useState(false);

  console.log("🔔 QUOTA BANNER: Checking visibility", { 
    isVisible: isCurrentlyVisible(), 
    hasError: !!state.quotaError,
    state: state
  });

  // Don't render if not visible or no quota error
  if (!isCurrentlyVisible() || !state.quotaError) {
    return null;
  }

  const quotaError = state.quotaError;

  // Parse quota type for user-friendly messaging
  const getQuotaMessage = () => {
    if (quotaError.quotaType.includes('daily') || quotaError.quotaType.includes('day')) {
      return {
        title: "Daily API Quota Reached",
        description: "You've reached your daily limit for AI image generation.",
        resetInfo: "Quota resets at midnight UTC (approximately 8PM EST)",
        timeframe: "24 hours"
      };
    } else if (quotaError.quotaType.includes('minute') || quotaError.quotaType.includes('per_minute')) {
      return {
        title: "Rate Limit Exceeded", 
        description: "Too many requests sent in a short time.",
        resetInfo: "Please wait a few minutes before trying again",
        timeframe: "a few minutes"
      };
    } else {
      return {
        title: "API Quota Exceeded",
        description: "You've reached your current API usage limit.",
        resetInfo: "Please check your plan or wait for quota reset",
        timeframe: "some time"
      };
    }
  };

  const quotaInfo = getQuotaMessage();

  return (
    <div className="sticky top-0 z-50 border-b border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 dark:border-orange-800">
      <Alert className="border-0 rounded-none bg-transparent">
        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="ml-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <div>
                <span className="font-medium text-orange-800 dark:text-orange-200">
                  {quotaInfo.title}
                </span>
                <span className="text-orange-700 dark:text-orange-300 ml-2">
                  {quotaInfo.description}
                </span>
              </div>
              
              <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-300">
                <Clock className="h-3 w-3 mr-1" />
                Resets in {quotaInfo.timeframe}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              {!isExpanded && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsExpanded(true)}
                  className="text-orange-700 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-200 dark:hover:bg-orange-900/20"
                  data-testid="button-expand-quota"
                >
                  More info
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => dismissTemporarily(30)}
                className="text-orange-700 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-200 dark:hover:bg-orange-900/20"
                data-testid="button-dismiss-quota"
              >
                <Clock className="h-3 w-3 mr-1" />
                Dismiss 30min
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearQuotaError}
                className="text-orange-700 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-200 dark:hover:bg-orange-900/20"
                data-testid="button-close-quota"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
              <div className="text-sm text-orange-700 dark:text-orange-300 space-y-2">
                <div className="flex items-start space-x-2">
                  <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">When will this reset?</div>
                    <div>{quotaInfo.resetInfo}</div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">What can I do now?</div>
                    <div>You can continue working on your comic project, but AI image generation will be temporarily unavailable. You can manually edit panels or wait for the quota to reset.</div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsExpanded(false)}
                    className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                    data-testid="button-collapse-quota"
                  >
                    Show less
                  </Button>
                </div>
              </div>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}