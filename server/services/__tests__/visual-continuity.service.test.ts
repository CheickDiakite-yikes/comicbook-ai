import { describe, expect, it } from '@jest/globals';
import { CharacterAppearanceAnalysis, VisualContinuityService } from '../VisualContinuityService';

describe('VisualContinuityService.extractCharacterAnalyses', () => {
  it('matches characters regardless of casing and preserves canonical names', () => {
    const service = new VisualContinuityService();
    const characterNames = ['Spider-Man', 'Mary Jane Watson'];

    const analysisData = {
      characters: [
        { characterName: 'spider-man', isPresent: true, confidence: 92 },
        { characterName: 'MARY JANE WATSON', isPresent: true, confidence: 87 },
        { characterName: 'Green Goblin', isPresent: true, confidence: 55 }
      ]
    };

    const results = (service as any).extractCharacterAnalyses(
      analysisData,
      characterNames
    ) as CharacterAppearanceAnalysis[];

    expect(results).toHaveLength(2);

    const spiderMan = results.find(result => result.characterName === 'Spider-Man');
    const maryJane = results.find(result => result.characterName === 'Mary Jane Watson');

    expect(spiderMan).toBeDefined();
    expect(spiderMan?.isPresent).toBe(true);
    expect(spiderMan?.confidence).toBe(92);

    expect(maryJane).toBeDefined();
    expect(maryJane?.isPresent).toBe(true);
    expect(maryJane?.confidence).toBe(87);
  });
});
