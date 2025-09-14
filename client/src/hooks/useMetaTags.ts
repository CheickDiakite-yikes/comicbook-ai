import { useEffect } from 'react';

interface MetaTagsConfig {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonicalUrl?: string;
}

export const useMetaTags = (config: MetaTagsConfig) => {
  useEffect(() => {
    // Store original values for cleanup
    const originalTitle = document.title;
    const originalMetas = new Map<string, string>();

    // Update document title
    if (config.title) {
      document.title = config.title;
    }

    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, content: string) => {
      let metaTag = document.querySelector(selector) as HTMLMetaElement;
      
      if (metaTag) {
        // Store original content
        if (!originalMetas.has(selector)) {
          originalMetas.set(selector, metaTag.content);
        }
        metaTag.content = content;
      } else {
        // Create new meta tag
        metaTag = document.createElement('meta');
        
        // Determine the attribute name and value based on selector
        if (selector.includes('property=')) {
          const property = selector.match(/property="([^"]+)"/)?.[1];
          if (property) {
            metaTag.setAttribute('property', property);
          }
        } else if (selector.includes('name=')) {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (name) {
            metaTag.setAttribute('name', name);
          }
        }
        
        metaTag.content = content;
        document.head.appendChild(metaTag);
      }
    };

    // Helper function to update or create link tag
    const updateLinkTag = (rel: string, href: string) => {
      let linkTag = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      
      if (linkTag) {
        linkTag.href = href;
      } else {
        linkTag = document.createElement('link');
        linkTag.rel = rel;
        linkTag.href = href;
        document.head.appendChild(linkTag);
      }
    };

    // Update meta description
    if (config.description) {
      updateMetaTag('meta[name="description"]', config.description);
    }

    // Update keywords
    if (config.keywords) {
      updateMetaTag('meta[name="keywords"]', config.keywords);
    }

    // Update Open Graph tags
    if (config.ogTitle || config.title) {
      updateMetaTag('meta[property="og:title"]', config.ogTitle || config.title);
    }

    if (config.ogDescription || config.description) {
      updateMetaTag('meta[property="og:description"]', config.ogDescription || config.description);
    }

    if (config.ogImage) {
      updateMetaTag('meta[property="og:image"]', config.ogImage);
      updateMetaTag('meta[property="og:image:secure_url"]', config.ogImage);
      // Update alt text for the image
      updateMetaTag('meta[property="og:image:alt"]', config.title);
    }

    // Update Twitter Card tags
    if (config.twitterTitle || config.title) {
      updateMetaTag('meta[name="twitter:title"]', config.twitterTitle || config.title);
    }

    if (config.twitterDescription || config.description) {
      updateMetaTag('meta[name="twitter:description"]', config.twitterDescription || config.description);
    }

    if (config.twitterImage || config.ogImage) {
      updateMetaTag('meta[name="twitter:image"]', config.twitterImage || config.ogImage || '');
      updateMetaTag('meta[name="twitter:image:alt"]', config.title);
    }

    // Update canonical URL
    if (config.canonicalUrl) {
      updateLinkTag('canonical', config.canonicalUrl);
    }

    // Cleanup function
    return () => {
      // Restore original title
      document.title = originalTitle;

      // Restore original meta tag contents
      originalMetas.forEach((originalContent, selector) => {
        const metaTag = document.querySelector(selector) as HTMLMetaElement;
        if (metaTag) {
          metaTag.content = originalContent;
        }
      });
    };
  }, [config.title, config.description, config.keywords, config.ogTitle, config.ogDescription, config.ogImage, config.twitterTitle, config.twitterDescription, config.twitterImage, config.canonicalUrl]);
};