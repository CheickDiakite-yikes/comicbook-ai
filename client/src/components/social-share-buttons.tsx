import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  Copy, 
  MessageSquare,
  Linkedin,
  Facebook
} from "lucide-react";
import { SiX } from "react-icons/si";

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
  hashtags?: string[];
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "ghost" | "outline";
}

export function SocialShareButtons({ 
  url, 
  title, 
  description = "", 
  image = "",
  hashtags = [],
  className = "",
  size = "sm",
  variant = "ghost"
}: SocialShareProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const hashtagString = hashtags.length > 0 ? hashtags.join(',') : 'AIComics,DigitalComics,ComicCreation';

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtagString}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
  };

  const handleShare = (platform: keyof typeof shareUrls) => {
    const url = shareUrls[platform];
    window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
    setIsOpen(false);
    
    toast({
      title: "Sharing opened",
      description: `Opened ${platform} sharing in a new tab`,
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsOpen(false);
      toast({
        title: "Link copied!",
        description: "Comic link has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again or copy the URL manually",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={`flex items-center space-x-1 text-muted-foreground hover:text-primary ${className}`}
          data-testid="share-button"
        >
          <Share2 className="w-4 h-4" />
          <span className="sr-only">Share comic</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="center" className="w-48">
        <DropdownMenuItem 
          onClick={() => handleShare('twitter')}
          className="cursor-pointer"
          data-testid="share-twitter"
        >
          <SiX className="w-4 h-4 mr-2" />
          Share on X
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleShare('facebook')}
          className="cursor-pointer"
          data-testid="share-facebook"
        >
          <Facebook className="w-4 h-4 mr-2" />
          Share on Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleShare('linkedin')}
          className="cursor-pointer"
          data-testid="share-linkedin"
        >
          <Linkedin className="w-4 h-4 mr-2" />
          Share on LinkedIn
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleShare('reddit')}
          className="cursor-pointer"
          data-testid="share-reddit"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Share on Reddit
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={handleCopyLink}
          className="cursor-pointer"
          data-testid="copy-link"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}