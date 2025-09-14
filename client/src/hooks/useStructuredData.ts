import { useEffect } from 'react';

export interface StructuredData {
  "@context": string;
  "@type": string;
  [key: string]: any;
}

/**
 * Hook for dynamically injecting JSON-LD structured data into the document head
 * Useful for SEO and rich snippets in search results
 * 
 * @param data - The structured data object following schema.org vocabulary
 * @param id - Optional unique ID for the script tag (defaults to 'dynamic-structured-data')
 */
export const useStructuredData = (data: StructuredData | null, id: string = 'dynamic-structured-data') => {
  useEffect(() => {
    if (!data) {
      // Remove existing structured data if data is null
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }
      return;
    }

    try {
      // Create new script element for JSON-LD
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.text = JSON.stringify(data, null, 0); // Minified JSON for production

      // Remove any existing structured data with the same ID
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }

      // Add new structured data to document head
      document.head.appendChild(script);

      // Cleanup function to remove structured data when component unmounts
      return () => {
        const element = document.getElementById(id);
        if (element) {
          element.remove();
        }
      };
    } catch (error) {
      console.warn('Failed to inject structured data:', error);
    }
  }, [data, id]);
};

/**
 * Utility functions for creating common structured data schemas
 */

export interface ComicStructuredDataProps {
  title: string;
  description: string;
  creator: {
    name: string;
    url?: string;
  };
  genre?: string;
  coverImageUrl?: string;
  url: string;
  dateCreated?: string;
  likesCount?: number;
  commentsCount?: number;
}

export const createComicStructuredData = (props: ComicStructuredDataProps): StructuredData => {
  const baseUrl = window.location.origin;
  
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": props.url,
    "name": props.title,
    "description": props.description || `A ${props.genre || 'comic'} story created with AI on Kumayiri.`,
    "creator": {
      "@type": "Person",
      "name": props.creator.name,
      ...(props.creator.url && { "url": props.creator.url })
    },
    "publisher": {
      "@type": "Organization",
      "name": "Kumayiri",
      "url": baseUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/favicon.png`
      }
    },
    "url": props.url,
    "isAccessibleForFree": true,
    "inLanguage": "en",
    "creativeWorkStatus": "Published",
    "artform": "Comic",
    "artMedium": "Digital",
    "artworkSurface": "Digital Canvas",
    ...(props.genre && { "genre": props.genre }),
    ...(props.coverImageUrl && {
      "image": {
        "@type": "ImageObject",
        "url": props.coverImageUrl,
        "caption": `Cover art for ${props.title}`
      }
    }),
    ...(props.dateCreated && { "dateCreated": props.dateCreated }),
    ...(props.dateCreated && { "datePublished": props.dateCreated }),
    "audience": {
      "@type": "Audience",
      "audienceType": "Comic Readers"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": props.url
    },
    ...(props.likesCount !== undefined && {
      "interactionStatistic": [
        {
          "@type": "InteractionCounter",
          "interactionType": "https://schema.org/LikeAction",
          "userInteractionCount": props.likesCount
        },
        ...(props.commentsCount !== undefined ? [{
          "@type": "InteractionCounter", 
          "interactionType": "https://schema.org/CommentAction",
          "userInteractionCount": props.commentsCount
        }] : [])
      ]
    })
  };
};

export interface GalleryStructuredDataProps {
  title: string;
  description: string;
  url: string;
  comics: Array<{
    title: string;
    url: string;
    creator: string;
    genre?: string;
  }>;
}

export const createGalleryStructuredData = (props: GalleryStructuredDataProps): StructuredData => {
  const baseUrl = window.location.origin;
  
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": props.url,
    "name": props.title,
    "description": props.description,
    "url": props.url,
    "numberOfItems": props.comics.length,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": props.url
    },
    "publisher": {
      "@type": "Organization",
      "name": "Kumayiri",
      "url": baseUrl
    },
    "itemListElement": props.comics.map((comic, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "CreativeWork",
        "@id": comic.url,
        "name": comic.title,
        "url": comic.url,
        "creator": {
          "@type": "Person",
          "name": comic.creator
        },
        "artform": "Comic",
        ...(comic.genre && { "genre": comic.genre })
      }
    }))
  };
};

export interface CreatorStructuredDataProps {
  name: string;
  bio?: string;
  location?: string;
  website?: string;
  profileUrl: string;
  profileImageUrl?: string;
  joinDate?: string;
  comicsCount?: number;
}

export const createCreatorStructuredData = (props: CreatorStructuredDataProps): StructuredData => {
  const baseUrl = window.location.origin;
  
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": props.profileUrl,
    "name": props.name,
    "url": props.profileUrl,
    ...(props.bio && { "description": props.bio }),
    ...(props.location && { 
      "address": {
        "@type": "PostalAddress",
        "addressLocality": props.location
      }
    }),
    ...(props.website && { "sameAs": [props.website] }),
    ...(props.profileImageUrl && {
      "image": {
        "@type": "ImageObject",
        "url": props.profileImageUrl
      }
    }),
    "worksFor": {
      "@type": "Organization",
      "name": "Kumayiri",
      "url": baseUrl
    },
    "mainEntityOfPage": {
      "@type": "ProfilePage",
      "@id": props.profileUrl
    },
    "knowsAbout": [
      "Comic Creation",
      "Digital Art",
      "AI-Assisted Art Generation",
      "Visual Storytelling"
    ],
    "hasOccupation": {
      "@type": "Occupation",
      "name": "Comic Creator",
      "occupationLocation": {
        "@type": "Place",
        "name": "Kumayiri Platform"
      }
    },
    ...(props.joinDate && { "memberOf": {
      "@type": "Organization",
      "name": "Kumayiri Community",
      "foundingDate": props.joinDate
    }}),
    ...(props.comicsCount !== undefined && {
      "hasCreativeWork": {
        "@type": "CreativeWork",
        "name": `${props.comicsCount} Comics Created`,
        "description": `Portfolio of ${props.comicsCount} AI-generated comics`
      }
    })
  };
};