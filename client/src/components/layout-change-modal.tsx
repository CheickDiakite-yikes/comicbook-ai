import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LayoutTemplates from "@/components/layout-templates";
import { X } from "lucide-react";

interface LayoutChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentLayout: string;
  onLayoutChange: (layoutId: string) => void;
}

export default function LayoutChangeModal({ 
  open, 
  onClose, 
  currentLayout, 
  onLayoutChange 
}: LayoutChangeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Change Page Layout</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-layout-modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a new layout for your comic page. This will clear existing generated images.
          </p>
        </DialogHeader>
        
        <div className="mt-6">
          <LayoutTemplates 
            selectedTemplate={currentLayout}
            onSelectTemplate={onLayoutChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}