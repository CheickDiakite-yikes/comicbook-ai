/**
 * 🏗️ PHASE 5: MULTI-PAGE CONSISTENCY TRACKER
 * Track character appearance consistency across multiple pages and 100+ panels
 */

interface CharacterAppearanceRecord {
  characterName: string;
  pageNumber: number;
  panelId: string;
  imageUrl: string;
  prompt: string;
  consistencyScore: number;
  timestamp: Date;
  validationResult?: any;
}

interface ConsistencyTrend {
  characterName: string;
  scoreHistory: Array<{ pageNumber: number; score: number; }>;
  averageScore: number;
  trendDirection: 'improving' | 'degrading' | 'stable';
  flaggedPages: number[];
}

interface TrackerSummaryCharacter {
  characterName: string;
  totalAppearances: number;
  averageScore: number;
  trendDirection: 'improving' | 'degrading' | 'stable';
  flaggedPages: number[];
  lastAppearance?: CharacterAppearanceRecord;
}

export class MultiPageConsistencyTracker {
  private characterAppearances: Map<string, CharacterAppearanceRecord[]> = new Map();
  private consistencyTrends: Map<string, ConsistencyTrend> = new Map();

  /**
   * Update character appearance record for a specific panel
   */
  updateCharacterAppearance(
    characterName: string,
    pageNumber: number,
    panelId: string,
    data: {
      imageUrl: string;
      prompt: string;
      consistencyScore: number;
      validationResult?: any;
    }
  ): void {
    const record: CharacterAppearanceRecord = {
      characterName,
      pageNumber,
      panelId,
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      consistencyScore: data.consistencyScore,
      timestamp: new Date(),
      validationResult: data.validationResult
    };

    // Add to character appearances
    if (!this.characterAppearances.has(characterName)) {
      this.characterAppearances.set(characterName, []);
    }
    this.characterAppearances.get(characterName)!.push(record);

    // Update consistency trends
    this.updateConsistencyTrend(characterName, pageNumber, data.consistencyScore);

    console.log(`📊 Updated character appearance for ${characterName} on page ${pageNumber}: Score ${data.consistencyScore}/100`);
  }

  /**
   * Update consistency trend analysis for a character
   */
  private updateConsistencyTrend(characterName: string, pageNumber: number, score: number): void {
    if (!this.consistencyTrends.has(characterName)) {
      this.consistencyTrends.set(characterName, {
        characterName,
        scoreHistory: [],
        averageScore: 100,
        trendDirection: 'stable',
        flaggedPages: []
      });
    }

    const trend = this.consistencyTrends.get(characterName)!;
    trend.scoreHistory.push({ pageNumber, score });
    
    // Keep only recent history (last 20 appearances for trend analysis)
    if (trend.scoreHistory.length > 20) {
      trend.scoreHistory = trend.scoreHistory.slice(-20);
    }

    // Calculate average score
    trend.averageScore = Math.round(
      trend.scoreHistory.reduce((sum, entry) => sum + entry.score, 0) / trend.scoreHistory.length
    );

    // Determine trend direction
    if (trend.scoreHistory.length >= 3) {
      const recent = trend.scoreHistory.slice(-3);
      const recentAvg = recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length;
      const earlier = trend.scoreHistory.slice(-6, -3);
      
      if (earlier.length > 0) {
        const earlierAvg = earlier.reduce((sum, entry) => sum + entry.score, 0) / earlier.length;
        
        if (recentAvg > earlierAvg + 5) {
          trend.trendDirection = 'improving';
        } else if (recentAvg < earlierAvg - 5) {
          trend.trendDirection = 'degrading';
        } else {
          trend.trendDirection = 'stable';
        }
      }
    }

    // Flag problematic pages
    if (score < 70 && !trend.flaggedPages.includes(pageNumber)) {
      trend.flaggedPages.push(pageNumber);
    }
  }

  /**
   * Generate a comprehensive consistency report for a specific page checkpoint
   */
  generateCheckpointReport(pageNumber: number): {
    pageNumber: number;
    characterSummaries: Array<{
      characterName: string;
      appearanceCount: number;
      averageScore: number;
      trendDirection: string;
      recentScore: number;
      recommendation: string;
    }>;
    overallHealth: 'excellent' | 'good' | 'concerning' | 'critical';
    recommendations: string[];
  } {
    const characterSummaries: Array<{
      characterName: string;
      appearanceCount: number;
      averageScore: number;
      trendDirection: string;
      recentScore: number;
      recommendation: string;
    }> = [];

    const recommendations: string[] = [];
    let totalScore = 0;
    let characterCount = 0;

    // Analyze each character's consistency up to this page
    for (const [characterName, appearances] of Array.from(this.characterAppearances.entries())) {
      const relevantAppearances = appearances.filter(app => app.pageNumber <= pageNumber);
      
      if (relevantAppearances.length === 0) continue;

      const trend = this.consistencyTrends.get(characterName);
      const recentScore = relevantAppearances[relevantAppearances.length - 1].consistencyScore;
      const averageScore = trend?.averageScore || recentScore;

      let recommendation = 'Continue monitoring';
      
      if (averageScore < 60) {
        recommendation = 'URGENT: Generate new reference portrait and review character prompts';
        recommendations.push(`${characterName}: Critical consistency issues (avg: ${averageScore}/100)`);
      } else if (averageScore < 75) {
        recommendation = 'Review character descriptions and strengthen prompts';
        recommendations.push(`${characterName}: Moderate consistency issues (avg: ${averageScore}/100)`);
      } else if (trend?.trendDirection === 'degrading') {
        recommendation = 'Watch for continued degradation, consider prompt reinforcement';
        recommendations.push(`${characterName}: Consistency degrading trend detected`);
      }

      characterSummaries.push({
        characterName,
        appearanceCount: relevantAppearances.length,
        averageScore,
        trendDirection: trend?.trendDirection || 'stable',
        recentScore,
        recommendation
      });

      totalScore += averageScore;
      characterCount++;
    }

    // Determine overall health
    const overallScore = characterCount > 0 ? totalScore / characterCount : 100;
    let overallHealth: 'excellent' | 'good' | 'concerning' | 'critical';
    
    if (overallScore >= 90) {
      overallHealth = 'excellent';
    } else if (overallScore >= 75) {
      overallHealth = 'good';
    } else if (overallScore >= 60) {
      overallHealth = 'concerning';
      recommendations.push('Consider implementing stricter consistency enforcement');
    } else {
      overallHealth = 'critical';
      recommendations.push('CRITICAL: Implement immediate consistency recovery measures');
    }

    return {
      pageNumber,
      characterSummaries,
      overallHealth,
      recommendations
    };
  }

  /**
   * Get character consistency history for analysis
   */
  getCharacterHistory(characterName: string): CharacterAppearanceRecord[] {
    return this.characterAppearances.get(characterName) || [];
  }

  /**
   * Get all character trends
   */
  getAllTrends(): Map<string, ConsistencyTrend> {
    return this.consistencyTrends;
  }

  /**
   * Summarize multi-page consistency health across all tracked characters
   */
  getSummary(): {
    overallHealth: 'excellent' | 'good' | 'concerning' | 'critical';
    characters: TrackerSummaryCharacter[];
  } {
    const characters: TrackerSummaryCharacter[] = [];

    for (const [characterName, appearances] of Array.from(this.characterAppearances.entries())) {
      const trend = this.consistencyTrends.get(characterName);
      const lastAppearance = appearances[appearances.length - 1];
      const averageScore = trend?.averageScore ?? Math.round(
        appearances.reduce((sum, record) => sum + record.consistencyScore, 0) / appearances.length
      );

      characters.push({
        characterName,
        totalAppearances: appearances.length,
        averageScore,
        trendDirection: trend?.trendDirection || 'stable',
        flaggedPages: trend?.flaggedPages || [],
        lastAppearance
      });
    }

    const overallScore = characters.length
      ? characters.reduce((sum, character) => sum + character.averageScore, 0) / characters.length
      : 100;

    let overallHealth: 'excellent' | 'good' | 'concerning' | 'critical';

    if (overallScore >= 90) {
      overallHealth = 'excellent';
    } else if (overallScore >= 75) {
      overallHealth = 'good';
    } else if (overallScore >= 60) {
      overallHealth = 'concerning';
    } else {
      overallHealth = 'critical';
    }

    return {
      overallHealth,
      characters
    };
  }

  /**
   * Detect characters with consistency issues that need intervention
   */
  getCharactersNeedingIntervention(): Array<{
    characterName: string;
    issues: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendedActions: string[];
  }> {
    const problematicCharacters: Array<{
      characterName: string;
      issues: string[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendedActions: string[];
    }> = [];

    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 } as const;

    const escalateSeverity = (
      current: 'low' | 'medium' | 'high' | 'critical',
      next: 'low' | 'medium' | 'high' | 'critical'
    ): 'low' | 'medium' | 'high' | 'critical' => {
      return severityOrder[next] > severityOrder[current] ? next : current;
    };

    for (const [characterName, trend] of Array.from(this.consistencyTrends.entries())) {
      const issues: string[] = [];
      const recommendedActions: string[] = [];
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Check average score
      if (trend.averageScore < 50) {
        issues.push(`Critical consistency score: ${trend.averageScore}/100`);
        severity = 'critical';
        recommendedActions.push('Generate new reference portrait immediately');
        recommendedActions.push('Review and strengthen character descriptions');
        recommendedActions.push('Implement manual review for this character');
      } else if (trend.averageScore < 70) {
        issues.push(`Low consistency score: ${trend.averageScore}/100`);
        severity = escalateSeverity(severity, 'high');
        recommendedActions.push('Review character prompts and strengthen consistency rules');
      }

      // Check trend direction
      if (trend.trendDirection === 'degrading') {
        issues.push('Consistency degrading over time');
        severity = escalateSeverity(severity, 'medium');
        recommendedActions.push('Implement trend reversal measures');
      }

      // Check flagged pages
      if (trend.flaggedPages.length > 3) {
        issues.push(`Multiple flagged pages: ${trend.flaggedPages.length}`);
        severity = escalateSeverity(severity, 'medium');
        recommendedActions.push('Review flagged pages for pattern analysis');
      }

      if (issues.length > 0) {
        problematicCharacters.push({
          characterName,
          issues,
          severity,
          recommendedActions
        });
      }
    }

    return problematicCharacters.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }
}