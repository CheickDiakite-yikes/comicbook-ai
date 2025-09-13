import { comicLayouts } from "@/lib/comic-layouts";
import { getPanelAspectRatioInfo, getOptimalImageCSS } from "@/lib/aspect-ratio-utils";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComicPageLayoutProps {
  layoutId: string;
  generatedImages: {[key: number]: string};
  generatedBackgrounds?: {[key: number]: string};
  selectedPanel: number | null;
  onPanelClick: (panelId: number) => void;
  onImageUpdate: (panelId: number, imageUrl: string) => void;
  onBackgroundUpdate?: (panelId: number, backgroundUrl: string) => void;
  panelStatus?: Record<number, {
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: string;
  }>;
  onRetryPanel?: (panelNumber: number) => void;
}

export default function ComicPageLayout({ 
  layoutId, 
  generatedImages, 
  generatedBackgrounds = {},
  selectedPanel, 
  onPanelClick,
  onImageUpdate,
  onBackgroundUpdate,
  panelStatus = {},
  onRetryPanel
}: ComicPageLayoutProps) {
  const layout = comicLayouts.find(l => l.id === layoutId) || comicLayouts[0];
  
  return (
    <div className="w-full h-full relative">
      {layout.panels.map((panel, index) => {
        const panelNumber = index + 1;
        const hasImage = generatedImages[panelNumber];
        const hasBackground = generatedBackgrounds[panelNumber];
        const status = panelStatus[panelNumber];
        
        // Calculate optimal CSS sizing based on panel dimensions
        const panelAspectRatio = panel.width / panel.height;
        const optimalCSS = getOptimalImageCSS(panelAspectRatio);
        
        // Determine border color based on status
        let borderColorClass = 'border-border hover:border-primary';
        if (selectedPanel === panelNumber) {
          borderColorClass = 'border-primary bg-accent shadow-lg';
        } else if (status?.status === 'pending') {
          borderColorClass = 'border-blue-500 bg-blue-50 dark:bg-blue-950';
        } else if (status?.status === 'error') {
          borderColorClass = 'border-red-500 bg-red-50 dark:bg-red-950';
        } else if (status?.status === 'success' || hasImage) {
          borderColorClass = 'border-green-500 bg-green-50 dark:bg-green-950';
        }
        
        return (
          <div
            key={panelNumber}
            className={`absolute bg-gradient-to-br from-chart-${(index % 5) + 1}/10 to-chart-${((index + 1) % 5) + 1}/10 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${borderColorClass}`}
            style={{
              left: `${panel.x * 100}%`,
              top: `${panel.y * 100}%`,
              width: `${panel.width * 100}%`,
              height: `${panel.height * 100}%`,
            }}
            onClick={() => onPanelClick(panelNumber)}
            data-testid={`panel-${panelNumber}`}
          >
            {hasImage ? (
              <div className="w-full h-full relative overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={hasImage}
                  alt={`Generated panel ${panelNumber}`}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                    width: '100%',
                    height: '100%'
                  }}
                  onError={() => {
                    console.error(`Failed to load image for panel ${panelNumber}`);
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs font-medium">Panel {panelNumber}</p>
                </div>
                {status?.status === 'success' && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px]">✓</span>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="w-full h-full flex flex-col items-center justify-center p-2 relative overflow-hidden rounded-lg"
                style={{
                  backgroundImage: hasBackground ? `url(${hasBackground})` : undefined,
                  ...optimalCSS,
                  backgroundColor: hasBackground ? 'transparent' : undefined
                }}
              >
                {hasBackground && (
                  <div className="absolute inset-0 bg-black/10 rounded-lg" />
                )}
                
                {status?.status === 'pending' ? (
                  <div className="flex flex-col items-center justify-center gap-2 z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <p className="text-xs text-center text-blue-700 dark:text-blue-300 font-medium">
                      Generating<br/>Panel {panelNumber}
                    </p>
                  </div>
                ) : status?.status === 'error' ? (
                  <div className="flex flex-col items-center justify-center gap-2 z-10">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <p className="text-xs text-center text-red-700 dark:text-red-300 font-medium">
                      Generation Failed<br/>Panel {panelNumber}
                    </p>
                    {onRetryPanel && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryPanel(panelNumber);
                        }}
                        data-testid={`retry-panel-${panelNumber}`}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    )}
                    {status.error && (
                      <p className="text-xs text-center text-red-600 dark:text-red-400 max-w-full overflow-hidden text-ellipsis">
                        {status.error.length > 50 ? status.error.substring(0, 50) + '...' : status.error}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={`text-xs text-center z-10 ${
                    hasBackground ? 'text-white drop-shadow-lg font-medium' : 'text-muted-foreground'
                  }`}>
                    Panel {panelNumber}<br/>
                    {hasBackground ? 'Background ready' : 'Click to select'}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}