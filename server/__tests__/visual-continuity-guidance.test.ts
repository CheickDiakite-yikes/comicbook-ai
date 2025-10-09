import { describe, it, expect } from '@jest/globals';
import { visualContinuityService } from '../services/VisualContinuityService';
import { VisualContinuityAnalysisResponse } from '../services/VisualContinuityService';

describe('VisualContinuityService.generateContinuityGuidance', () => {
  it('uses common appearance fallbacks when a character has no recorded panel appearances', async () => {
    const analysisResponse: VisualContinuityAnalysisResponse = {
      success: true,
      totalPanelsAnalyzed: 0,
      panelAnalyses: [],
      characterSummary: [
        {
          characterName: 'Mystery Hero',
          appearedInPanels: [],
          consistencyScore: 92,
          commonAppearance: {
            mostCommonClothing: 'casual jacket and boots',
            mostCommonHairStyle: 'long braided auburn hair',
            consistentFeatures: ['freckles', 'confident stance']
          },
          variations: []
        }
      ],
      overallInsights: {
        settingConsistency: 'consistent urban backdrops',
        notablePatterns: [],
        timeProgression: undefined
      }
    };

    const guidance = await visualContinuityService.generateContinuityGuidance(analysisResponse);

    expect(guidance.success).toBe(true);
    expect(guidance.error).toBeUndefined();
    expect(guidance.characterGuidance).toHaveLength(1);

    const [mysteryHeroGuidance] = guidance.characterGuidance;

    expect(mysteryHeroGuidance.characterName).toBe('Mystery Hero');
    expect(mysteryHeroGuidance.lastSeenPanel).toBeNull();
    expect(mysteryHeroGuidance.keyAttributes.source).toBe('common');
    expect(mysteryHeroGuidance.keyAttributes.hair).toBe('long braided auburn hair');
    expect(mysteryHeroGuidance.keyAttributes.clothing).toBe('casual jacket and boots');
    expect(mysteryHeroGuidance.keyAttributes.physicalFeatures).toContain('consistent features: freckles, confident stance');
    expect(mysteryHeroGuidance.keyAttributes.accessories).toContain('include established details: freckles, confident stance');
    expect(mysteryHeroGuidance.prompt).toContain('[REFERENCE COMMON APPEARANCE]');
    expect(mysteryHeroGuidance.prompt).toContain('consistent features: freckles, confident stance');
  });
});
