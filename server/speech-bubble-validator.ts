/**
 * AI-Powered Speech Bubble Validation System
 * Uses Gemini to analyze generated images and validate speech bubble placement
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1 scale
  issues: string[];
  suggestions: string[];
  bubblePositions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    distanceFromEdges: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  }>;
}

/**
 * Analyze a generated comic panel image to validate speech bubble placement
 */
export async function validateSpeechBubblePlacement(
  imagePath: string,
  expectedDimensions: { width: number; height: number },
  panelContext?: any
): Promise<ValidationResult> {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const imageBytes = fs.readFileSync(imagePath);
    
    const analysisPrompt = `
COMIC PANEL SPEECH BUBBLE ANALYSIS TASK:

Analyze this comic panel image and evaluate the placement of speech bubbles and text elements.

PANEL SPECIFICATIONS:
- Expected dimensions: ${expectedDimensions.width}×${expectedDimensions.height} pixels
- Panel context: ${panelContext ? JSON.stringify(panelContext, null, 2) : 'Not provided'}

ANALYSIS REQUIREMENTS:
1. Identify all speech bubbles, text boxes, and dialogue elements in the image
2. Measure their position relative to the panel edges (as percentages)
3. Check if text is readable and not cut off at panel boundaries
4. Evaluate adherence to comic industry safe zone standards

SAFE ZONE RULES TO CHECK:
- No speech bubbles within 10% of any edge for large panels
- No speech bubbles within 6% of any edge for medium panels  
- No speech bubbles within 3% of any edge for small panels
- Text should be clearly readable
- No partial words or cut-off dialogue

OUTPUT FORMAT (JSON):
{
  "isValid": boolean,
  "confidence": number (0.0 to 1.0),
  "issues": ["array of specific problems found"],
  "suggestions": ["array of improvement recommendations"],
  "bubblePositions": [
    {
      "x": number (center X as percentage of image width),
      "y": number (center Y as percentage of image height), 
      "width": number (bubble width as percentage),
      "height": number (bubble height as percentage),
      "distanceFromEdges": {
        "top": number (distance from top edge as percentage),
        "bottom": number (distance from bottom edge as percentage),
        "left": number (distance from left edge as percentage),
        "right": number (distance from right edge as percentage)
      }
    }
  ]
}

Analyze the image carefully and provide detailed feedback.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            isValid: { type: "boolean" },
            confidence: { type: "number" },
            issues: { 
              type: "array",
              items: { type: "string" }
            },
            suggestions: {
              type: "array", 
              items: { type: "string" }
            },
            bubblePositions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                  distanceFromEdges: {
                    type: "object",
                    properties: {
                      top: { type: "number" },
                      bottom: { type: "number" },
                      left: { type: "number" },
                      right: { type: "number" }
                    }
                  }
                }
              }
            }
          },
          required: ["isValid", "confidence", "issues", "suggestions", "bubblePositions"]
        }
      },
      contents: [
        {
          inlineData: {
            data: imageBytes.toString("base64"),
            mimeType: "image/jpeg",
          },
        },
        analysisPrompt
      ],
    });

    const rawResponse = response.text;
    if (!rawResponse) {
      throw new Error("Empty response from AI analysis");
    }

    const result: ValidationResult = JSON.parse(rawResponse);
    
    // Validate the response structure
    if (typeof result.isValid !== 'boolean' || 
        typeof result.confidence !== 'number' ||
        !Array.isArray(result.issues) ||
        !Array.isArray(result.suggestions)) {
      throw new Error("Invalid response format from AI analysis");
    }

    return result;

  } catch (error) {
    console.error("Speech bubble validation error:", error);
    
    // Return a default error result
    return {
      isValid: false,
      confidence: 0,
      issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ["Regenerate the panel with adjusted speech bubble placement"],
      bubblePositions: []
    };
  }
}

/**
 * Batch validate multiple comic panels
 */
export async function validateMultiplePanels(
  panelData: Array<{
    imagePath: string;
    dimensions: { width: number; height: number };
    panelContext?: any;
    layoutId: string;
    panelNumber: number;
  }>
): Promise<Array<ValidationResult & { layoutId: string; panelNumber: number }>> {
  const results = [];
  
  for (const panel of panelData) {
    console.log(`Validating ${panel.layoutId} Panel ${panel.panelNumber}...`);
    
    const validation = await validateSpeechBubblePlacement(
      panel.imagePath,
      panel.dimensions,
      panel.panelContext
    );
    
    results.push({
      ...validation,
      layoutId: panel.layoutId,
      panelNumber: panel.panelNumber
    });
    
    // Small delay to prevent API rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Generate a comprehensive validation report
 */
export function generateValidationReport(
  validationResults: Array<ValidationResult & { layoutId: string; panelNumber: number }>
): {
  overallSuccess: boolean;
  successRate: number;
  problemPanels: Array<{ layoutId: string; panelNumber: number; issues: string[] }>;
  commonIssues: Record<string, number>;
  recommendations: string[];
} {
  const totalPanels = validationResults.length;
  const validPanels = validationResults.filter(r => r.isValid).length;
  const successRate = totalPanels > 0 ? validPanels / totalPanels : 0;
  
  const problemPanels = validationResults
    .filter(r => !r.isValid)
    .map(r => ({
      layoutId: r.layoutId,
      panelNumber: r.panelNumber,
      issues: r.issues
    }));
  
  // Count common issues
  const commonIssues: Record<string, number> = {};
  for (const result of validationResults) {
    for (const issue of result.issues) {
      commonIssues[issue] = (commonIssues[issue] || 0) + 1;
    }
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (successRate < 0.8) {
    recommendations.push("Consider increasing safe zone margins for better speech bubble placement");
  }
  if (problemPanels.length > 0) {
    recommendations.push("Review panel sizing - some panels may be too small for readable dialogue");
  }
  
  return {
    overallSuccess: successRate >= 0.9,
    successRate,
    problemPanels,
    commonIssues,
    recommendations
  };
}