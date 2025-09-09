import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Share, Globe, Lock, QrCode } from "lucide-react";
import type { Project } from "@shared/schema";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}

export function ShareDialog({ open, onOpenChange, project }: ShareDialogProps) {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);
  
  if (!project) return null;
  
  const shareUrl = `${window.location.origin}/share/${project.id}`;
  
  const handleCopyLink = async () => {
    if (!project.isPublic) {
      toast({
        title: "Comic must be public to share",
        description: "Make your comic public first to generate a shareable link.",
        variant: "destructive"
      });
      return;
    }
    
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to your clipboard."
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    } finally {
      setCopying(false);
    }
  };
  
  const handleOpenPreview = () => {
    if (!project.isPublic) {
      toast({
        title: "Comic must be public to preview",
        description: "Make your comic public first to preview the shared version.",
        variant: "destructive"
      });
      return;
    }
    window.open(shareUrl, '_blank');
  };
  
  const handleSocialShare = (platform: string) => {
    if (!project.isPublic) {
      toast({
        title: "Comic must be public to share",
        description: "Make your comic public first to share on social media.",
        variant: "destructive"
      });
      return;
    }
    
    const text = `Check out my comic "${project.title}" created with Kumayiri!`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(shareUrl);
    
    let shareLink = '';
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'reddit':
        shareLink = `https://reddit.com/submit?title=${encodedText}&url=${encodedUrl}`;
        break;
      default:
        return;
    }
    
    window.open(shareLink, '_blank', 'width=600,height=400');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share Your Comic
          </DialogTitle>
          <DialogDescription>
            Generate shareable links and share your comic on social media
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Project Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <h3 className="font-medium">{project.title}</h3>
              <div className="flex items-center gap-1 mt-1">
                {project.isPublic ? (
                  <>
                    <Globe className="h-3 w-3 text-emerald-600" />
                    <Badge variant="default" className="text-xs">Public</Badge>
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">Private</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {project.isPublic ? (
            <>
              {/* Share Link */}
              <div className="space-y-2">
                <Label htmlFor="share-link">Share Link</Label>
                <div className="flex space-x-2">
                  <Input
                    id="share-link"
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-share-link"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleCopyLink}
                    disabled={copying}
                    data-testid="button-copy-link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleOpenPreview}
                  className="w-full"
                  data-testid="button-preview-share"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => toast({ title: "QR Code", description: "QR code sharing coming soon!" })}
                  className="w-full"
                  data-testid="button-qr-code"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
              </div>

              {/* Social Media Sharing */}
              <div className="space-y-2">
                <Label>Share on Social Media</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleSocialShare('twitter')}
                    className="w-full text-xs"
                    data-testid="button-share-twitter"
                  >
                    🐦 Twitter
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleSocialShare('facebook')}
                    className="w-full text-xs"
                    data-testid="button-share-facebook"
                  >
                    📘 Facebook
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleSocialShare('reddit')}
                    className="w-full text-xs"
                    data-testid="button-share-reddit"
                  >
                    🔶 Reddit
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Private Project Message */
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Comic is Private</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Make your comic public to generate shareable links and allow others to discover your work.
                </p>
              </div>
              <Button 
                variant="default"
                onClick={() => onOpenChange(false)}
                className="mt-3"
                data-testid="button-close-share"
              >
                Got it
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}