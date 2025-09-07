/**
 * Utility functions for calculating and handling aspect ratios in comic generation
 */

export interface AspectRatioInfo {
  ratio: number;
  orientation: 'portrait' | 'landscape' | 'square';
  type: string;
}

/**
 * Calculate the aspect ratio of a panel based on its dimensions
 */
export function calculatePanelAspectRatio(width: number, height: number): number {
  if (height === 0) return 1; // Prevent division by zero
  return width / height;
}

/**
 * Determine panel type based on Google's natively supported aspect ratios
 */
export function determinePanelType(aspectRatio: number): string {
  // Match to Google's natively supported ratios for optimal AI generation
  if (Math.abs(aspectRatio - (16/9)) < 0.05) return "google-16-9";    // 16:9 Widescreen
  if (Math.abs(aspectRatio - (4/3)) < 0.05) return "google-4-3";      // 4:3 Fullscreen  
  if (Math.abs(aspectRatio - 1.0) < 0.05) return "google-1-1";        // 1:1 Square
  if (Math.abs(aspectRatio - (3/4)) < 0.05) return "google-3-4";      // 3:4 Portrait
  if (Math.abs(aspectRatio - (9/16)) < 0.05) return "google-9-16";    // 9:16 Tall Portrait
  
  // Fallbacks - try to map to closest Google ratio
  if (aspectRatio > 1.5) return "google-16-9";     // Use 16:9 for wide panels
  if (aspectRatio > 1.1) return "google-4-3";      // Use 4:3 for landscape
  if (aspectRatio > 0.9) return "google-1-1";      // Use 1:1 for near-square
  if (aspectRatio > 0.6) return "google-3-4";      // Use 3:4 for portrait
  return "google-9-16";                             // Use 9:16 for tall panels
}

/**
 * Get comprehensive aspect ratio information for a panel
 */
export function getPanelAspectRatioInfo(width: number, height: number): AspectRatioInfo {
  const ratio = calculatePanelAspectRatio(width, height);
  
  let orientation: 'portrait' | 'landscape' | 'square';
  if (Math.abs(ratio - 1) < 0.1) {
    orientation = 'square';
  } else if (ratio > 1) {
    orientation = 'landscape';
  } else {
    orientation = 'portrait';
  }

  return {
    ratio,
    orientation,
    type: determinePanelType(ratio)
  };
}

/**
 * Calculate page canvas aspect ratios
 */
export const PAGE_ASPECT_RATIOS = {
  desktop: 8.5 / 11, // ≈ 0.772 - Standard comic book page
  mobile: 0.85,      // Mobile optimized ratio
} as const;

/**
 * Get the appropriate page aspect ratio for the current device
 */
export function getPageAspectRatio(isMobile: boolean): number {
  return isMobile ? PAGE_ASPECT_RATIOS.mobile : PAGE_ASPECT_RATIOS.desktop;
}

/**
 * Calculate optimal dimensions for AI image generation with panel-specific sizing
 * Returns dimensions optimized for comic panel aspect ratios
 */
export function calculateOptimalDimensions(aspectRatio: number, targetArea = 1000000): { width: number; height: number } {
  // Calculate dimensions that maintain exact aspect ratio
  let height = Math.sqrt(targetArea / aspectRatio);
  let width = height * aspectRatio;
  
  // Apply panel-specific optimizations
  if (aspectRatio > 2.0) {
    // Ultra-wide panels - increase resolution for detail
    width = 1600;
    height = width / aspectRatio;
  } else if (aspectRatio > 1.5) {
    // Wide cinematic panels
    width = 1200;
    height = width / aspectRatio;
  } else if (aspectRatio < 0.6) {
    // Tall vertical panels
    height = 1200;
    width = height * aspectRatio;
  } else {
    // Standard and square panels
    width = Math.max(width, 800);
    height = Math.max(height, 800);
  }
  
  // Round to multiples of 8 for better AI generation
  const roundedWidth = Math.round(width / 8) * 8;
  const roundedHeight = Math.round(height / 8) * 8;
  
  return {
    width: roundedWidth,
    height: roundedHeight
  };
}

/**
 * Generate CSS properties for optimal image fitting
 * Always use cover to fill panels completely, accepting slight cropping
 */
export function getOptimalImageCSS(containerAspectRatio: number, imageAspectRatio?: number) {
  // Always use cover to ensure full panel coverage
  // This may crop slightly but eliminates white space
  return {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };
}

/**
 * Enhanced panel context generator for AI requests
 * @param panel - Panel dimensions as fractions of page (0-1 values)
 * @param layoutId - The layout template ID
 * @param panelNumber - The panel number in the layout
 * @param pageWidth - Actual page width in pixels (default 850)
 * @param pageHeight - Actual page height in pixels (default 1100)
 */
export function generateEnhancedPanelContext(
  panel: { width: number; height: number }, 
  layoutId: string, 
  panelNumber: number,
  pageWidth: number = 850,
  pageHeight: number = 1100
) {
  // Calculate actual pixel dimensions from fractional values
  const actualWidth = Math.round(panel.width * pageWidth);
  const actualHeight = Math.round(panel.height * pageHeight);
  
  const aspectRatioInfo = getPanelAspectRatioInfo(actualWidth, actualHeight);
  const optimalDimensions = calculateOptimalDimensions(aspectRatioInfo.ratio);

  return {
    layoutTemplate: layoutId,
    panelNumber,
    aspectRatio: aspectRatioInfo.ratio,
    orientation: aspectRatioInfo.orientation,
    panelType: aspectRatioInfo.type,
    dimensions: {
      width: actualWidth,  // Actual pixel width for processing
      height: actualHeight, // Actual pixel height for processing
      optimal: optimalDimensions
    }
  };
}