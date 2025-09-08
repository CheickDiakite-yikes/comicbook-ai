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
      <DialogContent className="max-w-5xl w-[92vw] max-h-[85vh] p-0">
        <div className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b bg-background">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  Change Page Layout
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Select a new layout for your comic page. This will clear existing generated images.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose} 
                className="flex-shrink-0 h-8 w-8 p-0 hover:bg-muted"
                data-testid="button-close-layout-modal"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close dialog</span>
              </Button>
            </div>
          </DialogHeader>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            <LayoutTemplates 
              selectedTemplate={currentLayout}
              onSelectTemplate={onLayoutChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}