/**
 * URL helper utilities for generating absolute URLs in Replit deployment
 */

/**
 * Get the base URL for the current request, handling Replit deployment
 * Uses X-Forwarded-* headers when available (common in deployed environments)
 */
export function getBaseUrl(req: any): string {
  // Check for forwarded headers first (Replit deployment)
  const forwardedProto = req.get('X-Forwarded-Proto') || req.get('x-forwarded-proto');
  const forwardedHost = req.get('X-Forwarded-Host') || req.get('x-forwarded-host') || req.get('Host') || req.get('host');
  
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Fallback to request protocol and host
  const protocol = req.protocol || (req.secure ? 'https' : 'http');
  const host = req.get('host') || 'localhost:5000';
  
  return `${protocol}://${host}`;
}

/**
 * Convert a relative or object storage path to an absolute URL
 */
export function buildAbsoluteUrl(urlOrPath: string, req: any): string {
  if (!urlOrPath) return '';

  // If already absolute URL, return as-is
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }

  const baseUrl = getBaseUrl(req);

  // Handle object storage paths
  if (urlOrPath.startsWith('/objects/')) {
    return `${baseUrl}${urlOrPath}`;
  }

  // Handle generated image paths
  if (urlOrPath.startsWith('/generated/')) {
    return `${baseUrl}${urlOrPath}`;
  }

  // Handle other relative paths
  if (urlOrPath.startsWith('/')) {
    return `${baseUrl}${urlOrPath}`;
  }

  // If no leading slash, add one
  return `${baseUrl}/${urlOrPath}`;
}

/**
 * Ensure an image URL is publicly accessible and absolute
 * This handles object storage URLs and converts them to public URLs
 */
export function ensurePublicImageUrl(imageUrl: string | null | undefined, req: any): string {
  if (!imageUrl) {
    // Return default/fallback image URL
    return buildAbsoluteUrl('/favicon.png', req);
  }

  // Convert to absolute URL
  const absoluteUrl = buildAbsoluteUrl(imageUrl, req);

  // For object storage URLs, ensure they're publicly accessible
  // The object storage service should handle ACL and public access
  return absoluteUrl;
}

/**
 * Sanitize and escape HTML content for meta tags
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Truncate text to a specific length for meta descriptions
 */
export function truncateText(text: string, maxLength: number = 160): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Try to cut at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}