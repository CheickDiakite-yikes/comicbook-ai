import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { comicLayouts } from "@/lib/comic-layouts";
import { Check } from "lucide-react";

interface LayoutTemplatesProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export default function LayoutTemplates({ selectedTemplate, onSelectTemplate }: LayoutTemplatesProps) {
  return (
    <div 
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
      role="grid"
      aria-label="Comic layout templates"
    >
      {comicLayouts.map((template, index) => {
        const isSelected = selectedTemplate === template.id;
        
        return (
          <div key={template.id} role="gridcell">
            <Button
              variant="ghost"
              className={`layout-template w-full h-auto p-0 border-2 hover:shadow-lg transition-all min-h-[160px] sm:min-h-[200px] rounded-lg ${
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
                <CardContent className="p-3 sm:p-4 relative">
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
                    </div>
                  )}
                  
                  {/* Template Preview */}
                  <div 
                    className="aspect-square bg-white rounded-lg p-3 sm:p-4 mb-3 shadow-sm" 
                    dangerouslySetInnerHTML={{ __html: template.svg }}
                    aria-hidden="true"
                  />
                  
                  {/* Template Info */}
                  <div className="text-left">
                    <h3 className="font-medium text-sm sm:text-base mb-1">{template.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{template.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{template.panelCount} panels</p>
                  </div>
                </CardContent>
              </Card>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
