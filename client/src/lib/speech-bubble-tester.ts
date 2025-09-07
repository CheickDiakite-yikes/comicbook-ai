/**
 * Speech Bubble Testing System
 * Validates speech bubble placement across all comic layouts and panel sizes
 */

import { comicLayouts } from './comic-layouts';
import { generateEnhancedPanelContext } from './aspect-ratio-utils';
import { generateSpeechBubbleInstructions, calculateOptimalSafeZone, validateSpeechBubbleViability } from './speech-bubble-optimizer';

export interface TestResult {
  layoutId: string;
  layoutName: string;
  panelNumber: number;
  dimensions: {
    widthPx: number;
    heightPx: number;
    aspectRatio: number;
    areaPixels: number;
  };
  safeZone: {
    safeZonePercentage: number;
    edgeMarginPercentage: number;
    textScaleRecommendation: string;
  };
  viability: {
    isViable: boolean;
    confidence: string;
    recommendation: string;
  };
  instructions: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Test speech bubble placement across all comic layouts
 * @param pageWidth - Page width in pixels (default 850)
 * @param pageHeight - Page height in pixels (default 1100)
 */
export function testAllLayouts(pageWidth: number = 850, pageHeight: number = 1100): TestResult[] {
  const results: TestResult[] = [];
  
  for (const layout of comicLayouts) {
    for (let panelIndex = 0; panelIndex < layout.panels.length; panelIndex++) {
      const panel = layout.panels[panelIndex];
      const panelNumber = panelIndex + 1;
      
      // Calculate actual pixel dimensions
      const actualWidth = Math.round(panel.width * pageWidth);
      const actualHeight = Math.round(panel.height * pageHeight);
      const aspectRatio = actualWidth / actualHeight;
      const areaPixels = actualWidth * actualHeight;
      
      const dimensions = {
        widthPx: actualWidth,
        heightPx: actualHeight,
        aspectRatio,
        areaPixels
      };
      
      // Get safe zone calculations
      const safeZone = calculateOptimalSafeZone(dimensions);
      
      // Test viability
      const viability = validateSpeechBubbleViability(dimensions);
      
      // Generate adaptive instructions
      const instructions = generateSpeechBubbleInstructions(dimensions, {
        layoutId: layout.id,
        panelNumber
      });
      
      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (viability.confidence === 'high') riskLevel = 'low';
      else if (viability.confidence === 'medium') riskLevel = 'medium';
      else if (viability.confidence === 'low') riskLevel = 'high';
      else riskLevel = 'critical';
      
      results.push({
        layoutId: layout.id,
        layoutName: layout.name,
        panelNumber,
        dimensions,
        safeZone: {
          safeZonePercentage: safeZone.safeZonePercentage,
          edgeMarginPercentage: safeZone.edgeMarginPercentage,
          textScaleRecommendation: safeZone.textScaleRecommendation
        },
        viability,
        instructions,
        riskLevel
      });
    }
  }
  
  return results;
}

/**
 * Identify problematic panels that may have speech bubble issues
 */
export function identifyProblematicPanels(testResults: TestResult[]): TestResult[] {
  return testResults.filter(result => 
    result.riskLevel === 'high' || result.riskLevel === 'critical'
  );
}

/**
 * Generate summary report of speech bubble testing
 */
export function generateTestReport(testResults: TestResult[]): {
  totalPanels: number;
  riskDistribution: Record<string, number>;
  problematicPanels: TestResult[];
  recommendations: string[];
} {
  const riskDistribution = testResults.reduce((acc, result) => {
    acc[result.riskLevel] = (acc[result.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const problematicPanels = identifyProblematicPanels(testResults);
  
  const recommendations: string[] = [];
  
  if (riskDistribution.critical > 0) {
    recommendations.push(`${riskDistribution.critical} panels are too small for readable speech bubbles. Consider visual storytelling only.`);
  }
  
  if (riskDistribution.high > 0) {
    recommendations.push(`${riskDistribution.high} panels have limited space. Use very concise text and careful placement.`);
  }
  
  if (riskDistribution.medium > 0) {
    recommendations.push(`${riskDistribution.medium} panels have adequate space but require careful speech bubble positioning.`);
  }
  
  return {
    totalPanels: testResults.length,
    riskDistribution,
    problematicPanels,
    recommendations
  };
}

/**
 * Console utility to log test results in a readable format
 */
export function logTestResults(testResults: TestResult[]): void {
  console.log('\n🧪 SPEECH BUBBLE PLACEMENT TEST RESULTS');
  console.log('==========================================');
  
  const report = generateTestReport(testResults);
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`Total panels tested: ${report.totalPanels}`);
  console.log(`Risk distribution:`, report.riskDistribution);
  
  console.log(`\n⚠️ PROBLEMATIC PANELS (${report.problematicPanels.length}):`);
  for (const panel of report.problematicPanels) {
    console.log(`\n${panel.layoutName} - Panel ${panel.panelNumber} [${panel.riskLevel.toUpperCase()} RISK]`);
    console.log(`  Dimensions: ${panel.dimensions.widthPx}×${panel.dimensions.heightPx}px (${panel.dimensions.areaPixels.toLocaleString()} total pixels)`);
    console.log(`  Aspect Ratio: ${panel.dimensions.aspectRatio.toFixed(2)}:1`);
    console.log(`  Safe Zone: ${panel.safeZone.safeZonePercentage}% (${panel.safeZone.edgeMarginPercentage}% margins)`);
    console.log(`  Text Scale: ${panel.safeZone.textScaleRecommendation}`);
    console.log(`  Recommendation: ${panel.viability.recommendation}`);
  }
  
  console.log(`\n💡 RECOMMENDATIONS:`);
  for (const recommendation of report.recommendations) {
    console.log(`  • ${recommendation}`);
  }
  
  console.log('\n==========================================\n');
}

/**
 * Test a specific layout and panel combination
 */
export function testSpecificPanel(
  layoutId: string, 
  panelNumber: number, 
  pageWidth: number = 850, 
  pageHeight: number = 1100
): TestResult | null {
  const layout = comicLayouts.find(l => l.id === layoutId);
  if (!layout || panelNumber < 1 || panelNumber > layout.panels.length) {
    return null;
  }
  
  const allResults = testAllLayouts(pageWidth, pageHeight);
  return allResults.find(r => r.layoutId === layoutId && r.panelNumber === panelNumber) || null;
}