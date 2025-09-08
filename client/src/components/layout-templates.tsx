import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { comicLayouts } from "@/lib/comic-layouts";
import { Check } from "lucide-react";

interface LayoutTemplatesProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export default function LayoutTemplates({ selectedTemplate, onSelectTemplate }: LayoutTemplatesProps) {
  // Group layouts by panel count
  const groupedLayouts = comicLayouts.reduce((acc, template) => {
    const panelCount = template.panelCount;
    if (!acc[panelCount]) {
      acc[panelCount] = [];
    }
    acc[panelCount].push(template);
    return acc;
  }, {} as Record<number, typeof comicLayouts>);

  // Sort panel counts
  const sortedPanelCounts = Object.keys(groupedLayouts)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {sortedPanelCounts.map(panelCount => (
        <div key={panelCount}>
          <h3 className="text-sm font-semibold text-foreground mb-3 px-1">
            {panelCount === 1 ? '1 Panel' : `${panelCount} Panels`}
            <span className="text-xs text-muted-foreground ml-1">
              ({groupedLayouts[panelCount].length} options)
            </span>
          </h3>
          <div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
            role="grid"
            aria-label={`${panelCount} panel comic layout templates`}
          >
            {groupedLayouts[panelCount].map((template) => {
              const isSelected = selectedTemplate === template.id;
              
              return (
                <div key={template.id} role="gridcell">
                  <Button
                    variant="ghost"
                    className={`layout-template w-full h-auto p-0 border-2 hover:shadow-lg transition-all min-h-[120px] sm:min-h-[140px] rounded-lg ${
                      isSelected
                        ? "border-primary bg-accent shadow-md" 
                        : "border-border hover:border-primary"
                    }`}
                    onClick={() => onSelectTemplate(template.id)}
                    aria-label={`Select ${template.name} template: ${template.description}`}
                    aria-pressed={isSelected}
                    data-testid={`template-${template.id}`}
                  >
                    <Card className="w-full border-0 shadow-none">
                      <CardContent className="p-2 sm:p-3 relative">
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
                          </div>
                        )}
                        
                        {/* Template Preview */}
                        <div 
                          className="aspect-square bg-white rounded-md p-2 sm:p-2.5 mb-2 shadow-sm" 
                          dangerouslySetInnerHTML={{ __html: template.svg }}
                          aria-hidden="true"
                        />
                        
                        {/* Template Info */}
                        <div className="text-left">
                          <h4 className="font-medium text-xs sm:text-sm mb-0.5 leading-tight">{template.name}</h4>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 leading-tight">{template.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
