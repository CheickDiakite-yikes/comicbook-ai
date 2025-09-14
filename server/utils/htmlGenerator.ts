/**
 * HTML generator with Open Graph and Twitter Card meta tags for social media sharing
 */

import { escapeHtml, truncateText, ensurePublicImageUrl, getBaseUrl } from './urlHelpers';

export interface ProjectMetadata {
  id: string;
  title: string;
  description?: string;
  publicDescription?: string;
  coverArt?: string;
  previewImageUrl?: string;
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  likesCount?: number;
  commentsCount?: number;
  pagesCount?: number;
}

/**
 * Generate complete HTML with Open Graph and Twitter Card meta tags for social media sharing
 */
export function generateSSRHTML(project: ProjectMetadata | null, req: any): string {
  const baseUrl = getBaseUrl(req);
  const shareUrl = `${baseUrl}/share/${project?.id || ''}`;
  
  // Default fallback values
  const siteName = 'Kumayiri AI Comics';
  const defaultTitle = 'AI-Generated Comics | Kumayiri';
  const defaultDescription = 'Create stunning comics with AI-powered visual storytelling on Kumayiri. Transform your ideas into beautiful graphic narratives.';
  const defaultImage = `${baseUrl}/favicon.png`;
  
  // Project-specific metadata
  let title = defaultTitle;
  let description = defaultDescription;
  let imageUrl = defaultImage;
  let creatorName = '';
  
  if (project) {
    title = escapeHtml(project.title || defaultTitle);
    
    // Use public description first, then regular description
    const projectDesc = project.publicDescription || project.description || '';
    description = projectDesc ? truncateText(escapeHtml(projectDesc), 160) : defaultDescription;
    
    // Get creator name
    const firstName = project.user?.firstName || '';
    const lastName = project.user?.lastName || '';
    creatorName = [firstName, lastName].filter(Boolean).join(' ');
    
    // Enhance description with creator and stats
    if (creatorName) {
      if (projectDesc) {
        description = `${description} - Created by ${escapeHtml(creatorName)}`;
      } else {
        description = `A comic by ${escapeHtml(creatorName)} on ${siteName}`;
      }
    }
    
    // Add engagement stats if available
    const stats = [];
    if (project.likesCount && project.likesCount > 0) {
      stats.push(`${project.likesCount} likes`);
    }
    if (project.pagesCount && project.pagesCount > 0) {
      stats.push(`${project.pagesCount} pages`);
    }
    if (stats.length > 0) {
      description = `${description} • ${stats.join(', ')}`;
    }
    
    // Truncate final description to ensure it fits
    description = truncateText(description, 160);
    
    // Handle cover art image
    const projectImage = project.previewImageUrl || project.coverArt;
    if (projectImage) {
      imageUrl = ensurePublicImageUrl(projectImage, req);
    }
  }
  
  // Enhanced title for better social sharing
  const fullTitle = project ? `${title} | ${siteName}` : title;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Basic Meta Tags -->
  <title>${fullTitle}</title>
  <meta name="description" content="${description}" />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title} - Comic cover art" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:locale" content="en_US" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@kumayiri" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title} - Comic cover art" />
  
  <!-- Additional Meta Tags for Other Platforms -->
  <meta property="article:author" content="${creatorName ? escapeHtml(creatorName) : siteName}" />
  <meta property="article:section" content="Comics" />
  <meta property="article:tag" content="AI Comics, Visual Storytelling, Digital Art" />
  
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": title,
    "description": description,
    "image": imageUrl,
    "author": {
      "@type": "Person",
      "name": creatorName || 'Kumayiri Creator'
    },
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "url": baseUrl
    },
    "url": shareUrl,
    "genre": "Comic",
    "artform": "Digital Comic"
  }, null, 2)}
  </script>
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="${baseUrl}/favicon.png">
  <link rel="apple-touch-icon" href="${baseUrl}/apple-touch-icon.png">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${shareUrl}" />
  
  <!-- No redirect script to avoid infinite loops - SPA handles routing -->
  
  <!-- Basic Styles for Fallback -->
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .comic-preview {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 30px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .comic-cover {
      width: 100%;
      max-width: 400px;
      height: auto;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 2.5em;
      margin: 0 0 15px 0;
      font-weight: 700;
    }
    p {
      font-size: 1.2em;
      line-height: 1.6;
      margin: 0 0 25px 0;
      opacity: 0.9;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(45deg, #ff6b6b, #feca57);
      color: white;
      padding: 15px 30px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1em;
      transition: transform 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .loading {
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="comic-preview">
      ${project ? `
        <img src="${imageUrl}" alt="${title}" class="comic-cover" onerror="this.style.display='none'">
        <h1>${title}</h1>
        <p>${description}</p>
        ${creatorName ? `<p style="font-size: 1em; opacity: 0.8;">by ${escapeHtml(creatorName)}</p>` : ''}
      ` : `
        <h1>Comic Not Found</h1>
        <p>This comic may not be publicly available or may have been removed.</p>
      `}
      <a href="${baseUrl}${project ? `/share/${project.id}` : ''}" class="cta-button">
        ${project ? 'Read Comic' : 'Browse Comics'}
      </a>
      <div class="loading" style="margin-top: 20px; font-size: 0.9em; opacity: 0.7;">
        Loading full experience...
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a minimal fallback HTML for errors or when project is not found
 */
export function generateFallbackHTML(req: any, error?: string): string {
  const baseUrl = getBaseUrl(req);
  const siteName = 'Kumayiri AI Comics';
  const title = 'AI-Generated Comics | Kumayiri';
  const description = 'Create stunning comics with AI-powered visual storytelling on Kumayiri. Transform your ideas into beautiful graphic narratives.';
  const imageUrl = `${baseUrl}/favicon.png`;
  const shareUrl = `${baseUrl}/`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${title}</title>
  <meta name="description" content="${description}" />
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <link rel="icon" type="image/png" href="${baseUrl}/favicon.png">
  
  <!-- No redirect script to avoid issues - SPA handles routing -->
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  ${error ? `<p>Error: ${escapeHtml(error)}</p>` : ''}
  <a href="${baseUrl}/">Visit Kumayiri</a>
</body>
</html>`;
}