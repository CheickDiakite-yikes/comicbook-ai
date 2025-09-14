/**
 * Social media crawler detection utility
 * Detects various social media platform crawlers and bots that need server-side rendered content
 */

export function isSocialCrawler(userAgent?: string): boolean {
  if (!userAgent) return false;

  const ua = userAgent.toLowerCase();

  // List of social media crawlers and bots that need SSR
  const crawlerPatterns = [
    'twitterbot',
    'facebookexternalhit',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'applebot',
    'pinterest',
    'google-structured-data-testing-tool',
    'skypeuripreview',
    'vkshare',
    'facebookcatalog',
    'flipboard',
    'redditbot',
    'outbrain',
    'quora link preview',
    'rogerbot',
    'showyoubot',
    'tumblr',
    'viberbot',
    'w3c_validator',
    'baiduspider',
    'yandexbot',
    'bingbot',
    'googlebot',
    'duckduckbot',
    'slack-imgproxy',
    'developers.google.com/+/web/snippet',
    'embed.ly',
    'facebookplatform',
    'ia_archiver',
    'line/bot',
    'msft-bing',
    'telegram',
    'snapchat',
    'viber',
    'whatsapp',
    'wechat',
    'kakao',
    'naver',
    'twitter:crawler',
    'facebook:crawler',
    'linkpreview'
  ];

  return crawlerPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Check if request appears to be for link preview/meta tag extraction
 * This catches additional cases where crawlers might not identify themselves clearly
 */
export function isLinkPreviewRequest(req: any): boolean {
  const userAgent = req.get('user-agent') || '';
  const accept = req.get('accept') || '';
  
  // If it's definitely a social crawler, return true
  if (isSocialCrawler(userAgent)) {
    return true;
  }

  // Additional heuristics for link preview detection
  const hasJsonAccept = accept.includes('application/json');
  const hasHtmlAccept = accept.includes('text/html');
  const hasImageAccept = accept.includes('image/');
  
  // If request doesn't accept HTML, it's probably not a link preview
  if (!hasHtmlAccept && (hasJsonAccept || hasImageAccept)) {
    return false;
  }

  // Check for common preview-related headers
  const purpose = req.get('sec-fetch-dest');
  const mode = req.get('sec-fetch-mode');
  
  if (purpose === 'document' && mode === 'navigate') {
    // This could be a preview, but also a normal user navigation
    // Use additional hints
    const referer = req.get('referer') || '';
    const hasReferer = referer.length > 0;
    
    // If no referer and simple accept header, might be a crawler
    if (!hasReferer && accept === 'text/html' || accept === '*/*') {
      return true;
    }
  }

  return false;
}