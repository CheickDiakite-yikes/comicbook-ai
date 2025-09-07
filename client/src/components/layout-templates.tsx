import { Card, CardContent } from "@/components/ui/card";
import { comicLayouts } from "@/lib/comic-layouts";

interface LayoutTemplatesProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export default function LayoutTemplates({ selectedTemplate, onSelectTemplate }: LayoutTemplatesProps) {
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
      {comicLayouts.map((template) => (
        <Card
          key={template.id}
          className={`layout-template border cursor-pointer hover:shadow-lg transition-all ${
            selectedTemplate === template.id 
              ? "border-primary bg-accent" 
              : "border-border hover:border-primary"
          }`}
          onClick={() => onSelectTemplate(template.id)}
          data-testid={`template-${template.id}`}
        >
          <CardContent className="p-4">
            <div 
              className="aspect-square bg-white rounded-lg p-4 mb-3" 
              dangerouslySetInnerHTML={{ __html: template.svg }}
            />
            <h3 className="font-medium text-sm mb-1">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{template.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
