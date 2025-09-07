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
 * Determine panel type based on aspect ratio with more precise categorization
 */
export function determinePanelType(aspectRatio: number): string {
  if (aspectRatio > 2.5) return "ultra-wide";
  if (aspectRatio > 1.8) return "wide-cinematic";
  if (aspectRatio > 1.3) return "wide";
  if (aspectRatio > 0.8) return "standard";
  if (aspectRatio > 0.6) return "tall";
  return "tall-vertical";
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
 * Calculate optimal dimensions for AI image generation
 * Based on aspect ratio, returns dimensions that are:
 * - Multiples of 8 (optimal for AI generation)
 * - Within reasonable size limits
 * - Maintain exact aspect ratios
 */
export function calculateOptimalDimensions(aspectRatio: number, targetArea = 1000000): { width: number; height: number } {
  // Calculate dimensions that maintain exact aspect ratio
  const height = Math.sqrt(targetArea / aspectRatio);
  const width = height * aspectRatio;
  
  // Round to multiples of 8 for better AI generation
  const roundedWidth = Math.round(width / 8) * 8;
  const roundedHeight = Math.round(height / 8) * 8;
  
  // Ensure minimum dimensions
  const minWidth = Math.max(roundedWidth, 512);
  const minHeight = Math.max(roundedHeight, 512);
  
  return {
    width: minWidth,
    height: minHeight
  };
}

/**
 * Generate CSS properties for optimal image fitting
 * Returns different strategies based on the aspect ratio match
 */
export function getOptimalImageCSS(containerAspectRatio: number, imageAspectRatio?: number) {
  // If we don't know the image aspect ratio, use cover as fallback
  if (!imageAspectRatio) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  }

  const aspectRatioDiff = Math.abs(containerAspectRatio - imageAspectRatio);
  
  // If aspect ratios are very close (within 5%), use cover for slight cropping
  if (aspectRatioDiff < 0.05) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  }
  
  // If image is much wider/taller than container, use contain to prevent cropping
  // This will show the full image but may leave some white space
  return {
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };
}

/**
 * Enhanced panel context generator for AI requests
 */
export function generateEnhancedPanelContext(panel: { width: number; height: number }, layoutId: string, panelNumber: number) {
  const aspectRatioInfo = getPanelAspectRatioInfo(panel.width, panel.height);
  const optimalDimensions = calculateOptimalDimensions(aspectRatioInfo.ratio);

  return {
    layoutTemplate: layoutId,
    panelNumber,
    aspectRatio: aspectRatioInfo.ratio,
    orientation: aspectRatioInfo.orientation,
    panelType: aspectRatioInfo.type,
    dimensions: {
      width: panel.width,
      height: panel.height,
      optimal: optimalDimensions
    }
  };
}