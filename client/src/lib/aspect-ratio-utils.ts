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
 * Determine panel type based on aspect ratio optimized for standard comic formats
 */
export function determinePanelType(aspectRatio: number): string {
  // Match to standard comic ratios for better AI generation
  if (Math.abs(aspectRatio - 1.778) < 0.1) return "cinematic-16-9";  // 16:9
  if (Math.abs(aspectRatio - 1.618) < 0.1) return "golden-ratio";    // Golden ratio
  if (Math.abs(aspectRatio - 1.5) < 0.1) return "standard-3-2";     // 3:2 
  if (Math.abs(aspectRatio - 1.0) < 0.1) return "perfect-square";   // 1:1
  if (Math.abs(aspectRatio - 0.667) < 0.1) return "standard-2-3";   // 2:3
  
  // Fallbacks for non-standard ratios
  if (aspectRatio > 2.0) return "ultra-wide";
  if (aspectRatio > 1.2) return "landscape";
  if (aspectRatio < 0.8) return "portrait";
  return "near-square";
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