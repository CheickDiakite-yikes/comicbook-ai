import { comicLayouts } from "@/lib/comic-layouts";

interface ComicPageLayoutProps {
  layoutId: string;
  generatedImages: {[key: number]: string};
  generatedBackgrounds?: {[key: number]: string};
  selectedPanel: number | null;
  onPanelClick: (panelId: number) => void;
  onImageUpdate: (panelId: number, imageUrl: string) => void;
  onBackgroundUpdate?: (panelId: number, backgroundUrl: string) => void;
}

export default function ComicPageLayout({ 
  layoutId, 
  generatedImages, 
  generatedBackgrounds = {},
  selectedPanel, 
  onPanelClick,
  onImageUpdate,
  onBackgroundUpdate
}: ComicPageLayoutProps) {
  const layout = comicLayouts.find(l => l.id === layoutId) || comicLayouts[0];
  
  return (
    <div className="w-full h-full relative">
      {layout.panels.map((panel, index) => {
        const panelNumber = index + 1;
        const hasImage = generatedImages[panelNumber];
        const hasBackground = generatedBackgrounds[panelNumber];
        
        return (
          <div
            key={panelNumber}
            className={`absolute bg-gradient-to-br from-chart-${(index % 5) + 1}/10 to-chart-${((index + 1) % 5) + 1}/10 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
              selectedPanel === panelNumber 
                ? 'border-primary bg-accent shadow-lg' 
                : 'border-border hover:border-primary'
            }`}
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
              <div className="w-full h-full relative overflow-hidden rounded-lg">
                <img
                  src={hasImage}
                  alt={`Generated panel ${panelNumber}`}
                  className="w-full h-full object-cover"
                  onError={() => {
                    console.error(`Failed to load image for panel ${panelNumber}`);
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs font-medium">Panel {panelNumber}</p>
                </div>
              </div>
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center p-2 relative overflow-hidden rounded-lg"
                style={{
                  backgroundImage: hasBackground ? `url(${hasBackground})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: hasBackground ? 'transparent' : undefined
                }}
              >
                {hasBackground && (
                  <div className="absolute inset-0 bg-black/10 rounded-lg" />
                )}
                <p className={`text-xs text-center z-10 ${
                  hasBackground ? 'text-white drop-shadow-lg font-medium' : 'text-muted-foreground'
                }`}>
                  Panel {panelNumber}<br/>
                  {hasBackground ? 'Background ready' : 'Click to select'}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}