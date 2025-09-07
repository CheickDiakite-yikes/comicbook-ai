/**
 * Speech Bubble Optimization System
 * Calculates adaptive safe zones based on panel dimensions for optimal text placement
 */

export interface SpeechBubbleSafeZone {
  safeZonePercentage: number;
  edgeMarginPercentage: number;
  textScaleRecommendation: 'large' | 'medium' | 'small' | 'minimal';
  compositionGuidance: string;
  criticalInstructions: string;
}

export interface PanelDimensions {
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  areaPixels: number;
}

/**
 * Calculate optimal safe zone based on panel pixel dimensions
 * Research-based approach considering readability and comic industry standards
 */
export function calculateOptimalSafeZone(dimensions: PanelDimensions): SpeechBubbleSafeZone {
  const { widthPx, heightPx, aspectRatio, areaPixels } = dimensions;
  const smallestDimension = Math.min(widthPx, heightPx);
  
  // Comic industry standards:
  // - Minimum readable text: 12pt ≈ 16px
  // - Minimum speech bubble: 80×40px
  // - Comfortable speech bubble: 120×60px
  
  if (areaPixels >= 400000) {
    // LARGE PANELS (>400k pixels) - Plenty of space
    return {
      safeZonePercentage: 70,
      edgeMarginPercentage: 15,
      textScaleRecommendation: 'large',
      compositionGuidance: 'Use generous spacing around speech bubbles. Multiple dialogue exchanges possible.',
      criticalInstructions: 'Keep ALL speech bubbles in the CENTER 70% of the panel. Ample space for multiple conversations.'
    };
  } else if (areaPixels >= 200000 && smallestDimension >= 350) {
    // MEDIUM PANELS (200k-400k pixels, 350px+ smallest dimension) - Good space
    return {
      safeZonePercentage: 80,
      edgeMarginPercentage: 10,
      textScaleRecommendation: 'medium',
      compositionGuidance: 'Moderate spacing around speech bubbles. 1-2 dialogue bubbles maximum.',
      criticalInstructions: 'Keep ALL speech bubbles in the CENTER 80% of the panel. Avoid clustering text near edges.'
    };
  } else if (areaPixels >= 100000 && smallestDimension >= 250) {
    // SMALL PANELS (100k-200k pixels, 250px+ smallest dimension) - Limited space
    return {
      safeZonePercentage: 88,
      edgeMarginPercentage: 6,
      textScaleRecommendation: 'small',
      compositionGuidance: 'Tight spacing. Single speech bubble or minimal text only.',
      criticalInstructions: 'Keep speech bubbles in the CENTER 88% of the panel. ONE speech bubble maximum. Use concise text.'
    };
  } else {
    // TINY PANELS (<100k pixels or <250px smallest dimension) - Minimal space
    return {
      safeZonePercentage: 94,
      edgeMarginPercentage: 3,
      textScaleRecommendation: 'minimal',
      compositionGuidance: 'Maximum efficiency. Single word/phrase only if absolutely necessary.',
      criticalInstructions: 'MINIMAL TEXT ONLY. If speech bubble required, use CENTER 94% of panel. Single short phrase maximum. Consider using visual storytelling instead of dialogue.'
    };
  }
}

/**
 * Generate aspect-ratio specific guidance for speech bubble placement
 */
export function getAspectRatioGuidance(aspectRatio: number, safeZone: SpeechBubbleSafeZone): string {
  let guidance = '';
  
  if (aspectRatio > 2.0) {
    // Ultra-wide panels
    guidance = `ULTRA-WIDE PANEL: Position speech bubbles in HORIZONTAL CENTER STRIP (middle 60% of height). Avoid left/right edges completely.`;
  } else if (aspectRatio > 1.5) {
    // Wide panels  
    guidance = `WIDE PANEL: Center speech bubbles HORIZONTALLY in the middle 65% of width. Use center vertical positioning.`;
  } else if (aspectRatio < 0.6) {
    // Tall narrow panels
    guidance = `TALL PANEL: Position speech bubbles in UPPER-MIDDLE section (avoid bottom 20%). Center horizontally in the middle 75% of width.`;
  } else if (aspectRatio < 0.8) {
    // Portrait panels
    guidance = `PORTRAIT PANEL: Center speech bubbles both horizontally and vertically. Use middle 70% of both width and height.`;
  } else {
    // Square-ish panels
    guidance = `SQUARE PANEL: Center speech bubbles in the absolute CENTER of the panel. Equal margins on all sides.`;
  }
  
  return guidance;
}

/**
 * Generate comprehensive AI prompt instructions for speech bubble placement
 */
export function generateSpeechBubbleInstructions(
  dimensions: PanelDimensions,
  layoutContext?: { layoutId: string; panelNumber: number }
): string {
  const safeZone = calculateOptimalSafeZone(dimensions);
  const aspectGuidance = getAspectRatioGuidance(dimensions.aspectRatio, safeZone);
  
  let instructions = `🎯 ADAPTIVE TEXT SAFE ZONE (${dimensions.widthPx}×${dimensions.heightPx}px): `;
  instructions += `${safeZone.criticalInstructions} `;
  instructions += `EDGE MARGIN: Keep ALL text ${safeZone.edgeMarginPercentage}% away from ALL edges. `;
  instructions += `${aspectGuidance} `;
  instructions += `TEXT SCALE: ${safeZone.textScaleRecommendation.toUpperCase()} text recommended for optimal readability. `;
  instructions += `${safeZone.compositionGuidance}`;
  
  return instructions;
}

/**
 * Validate if given panel dimensions can safely contain readable speech bubbles
 */
export function validateSpeechBubbleViability(dimensions: PanelDimensions): {
  isViable: boolean;
  confidence: 'high' | 'medium' | 'low' | 'critical';
  recommendation: string;
} {
  const { areaPixels, widthPx, heightPx } = dimensions;
  const smallestDimension = Math.min(widthPx, heightPx);
  
  if (areaPixels >= 200000 && smallestDimension >= 300) {
    return {
      isViable: true,
      confidence: 'high',
      recommendation: 'Excellent space for speech bubbles and dialogue.'
    };
  } else if (areaPixels >= 100000 && smallestDimension >= 200) {
    return {
      isViable: true,
      confidence: 'medium', 
      recommendation: 'Adequate space for single speech bubble with careful placement.'
    };
  } else if (areaPixels >= 50000 && smallestDimension >= 150) {
    return {
      isViable: true,
      confidence: 'low',
      recommendation: 'Minimal space. Use very short text or consider visual storytelling.'
    };
  } else {
    return {
      isViable: false,
      confidence: 'critical',
      recommendation: 'Panel too small for readable speech bubbles. Recommend visual storytelling only.'
    };
  }
}