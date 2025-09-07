import { useState } from "react";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import LayoutTemplates from "@/components/layout-templates";
import { Card, CardContent } from "@/components/ui/card";

export default function Templates() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-serif font-bold mb-2">Panel Templates</h1>
            <p className="text-muted-foreground">Choose from a variety of comic panel layouts to tell your story</p>
          </div>

          <LayoutTemplates 
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />

          {selectedTemplate && (
            <Card className="mt-6 border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2">Template Selected</h3>
                <p className="text-muted-foreground">
                  You've selected the <strong>{selectedTemplate}</strong> template. 
                  This layout will be applied to your next page creation.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
