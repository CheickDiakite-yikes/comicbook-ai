import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Enhanced image processing specifically for comic panels
 * Focuses on aggressive border removal and intelligent fitting
 */
export class ImageEnhancer {
  /**
   * Analyze image for white/light borders and return crop boundaries
   */
  private async detectBorders(imagePath: string): Promise<{
    top: number;
    left: number;
    width: number;
    height: number;
  }> {
    const image = sharp(imagePath);
    const { width, height, channels } = await image.metadata();
    
    if (!width || !height) {
      throw new Error("Cannot read image dimensions");
    }

    // Get raw pixel data
    const rawData = await image.raw().toBuffer();
    
    // Threshold for considering a pixel as "border" (light colored)
    const borderThreshold = 235; // Pixels with R,G,B all above this are considered border
    
    // Scan from edges to find content boundaries
    let topBorder = 0;
    let bottomBorder = height - 1;
    let leftBorder = 0;
    let rightBorder = width - 1;
    
    const bytesPerPixel = channels || 3;
    
    // Helper to check if pixel is "border-like"
    const isBorderPixel = (x: number, y: number): boolean => {
      const idx = (y * width + x) * bytesPerPixel;
      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];
      return r > borderThreshold && g > borderThreshold && b > borderThreshold;
    };
    
    // Find top border
    outer: for (let y = 0; y < height / 2; y++) {
      for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.9); x += 10) {
        if (!isBorderPixel(x, y)) {
          topBorder = Math.max(0, y - 5); // Small buffer
          break outer;
        }
      }
    }
    
    // Find bottom border
    outer: for (let y = height - 1; y > height / 2; y--) {
      for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.9); x += 10) {
        if (!isBorderPixel(x, y)) {
          bottomBorder = Math.min(height - 1, y + 5); // Small buffer
          break outer;
        }
      }
    }
    
    // Find left border
    outer: for (let x = 0; x < width / 2; x++) {
      for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y += 10) {
        if (!isBorderPixel(x, y)) {
          leftBorder = Math.max(0, x - 5); // Small buffer
          break outer;
        }
      }
    }
    
    // Find right border
    outer: for (let x = width - 1; x > width / 2; x--) {
      for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y += 10) {
        if (!isBorderPixel(x, y)) {
          rightBorder = Math.min(width - 1, x + 5); // Small buffer
          break outer;
        }
      }
    }
    
    return {
      top: topBorder,
      left: leftBorder,
      width: rightBorder - leftBorder,
      height: bottomBorder - topBorder
    };
  }

  /**
   * Enhanced panel fitting with multiple strategies
   */
  async fitImageToPanel(
    inputPath: string,
    panelWidth: number,
    panelHeight: number,
    panelNumber: number
  ): Promise<string> {
    const timestamp = Date.now();
    const outputDir = path.dirname(inputPath);
    const outputPath = path.join(outputDir, `panel_${panelNumber}_enhanced_${timestamp}.png`);
    
    try {
      console.log(`Enhancing panel ${panelNumber}: ${panelWidth}x${panelHeight}`);
      
      // Strategy 1: Try intelligent border detection
      let processedImage = sharp(inputPath);
      
      try {
        const cropBounds = await this.detectBorders(inputPath);
        console.log(`Detected borders for panel ${panelNumber}:`, cropBounds);
        
        // Extract content area
        processedImage = sharp(inputPath).extract(cropBounds);
      } catch (borderError) {
        console.log(`Border detection failed for panel ${panelNumber}, using trim`);
        // Fallback to Sharp's trim
        processedImage = sharp(inputPath).trim({
          background: { r: 255, g: 255, b: 255 },
          threshold: 40
        });
      }
      
      // Strategy 2: Apply zoom factor to eliminate edge artifacts
      const zoomFactor = 1.08; // 8% zoom to ensure full coverage
      const intermediateWidth = Math.round(panelWidth * zoomFactor);
      const intermediateHeight = Math.round(panelHeight * zoomFactor);
      
      // Resize with zoom
      const tempBuffer = await processedImage
        .resize(intermediateWidth, intermediateHeight, {
          fit: 'cover',
          position: 'centre',
          kernel: sharp.kernel.lanczos3
        })
        .toBuffer();
      
      // Strategy 3: Final crop to exact dimensions
      await sharp(tempBuffer)
        .extract({
          left: Math.round((intermediateWidth - panelWidth) / 2),
          top: Math.round((intermediateHeight - panelHeight) / 2),
          width: panelWidth,
          height: panelHeight
        })
        .png({ quality: 95, compressionLevel: 9 })
        .toFile(outputPath);
      
      console.log(`Enhanced panel ${panelNumber} saved to ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error(`Failed to enhance panel ${panelNumber}:`, error);
      
      // Ultimate fallback: Simple resize with heavy zoom
      const fallbackPath = path.join(outputDir, `panel_${panelNumber}_fallback_${timestamp}.png`);
      
      await sharp(inputPath)
        .resize(Math.round(panelWidth * 1.15), Math.round(panelHeight * 1.15), {
          fit: 'cover',
          position: 'centre'
        })
        .extract({
          left: Math.round(panelWidth * 0.075),
          top: Math.round(panelHeight * 0.075),
          width: panelWidth,
          height: panelHeight
        })
        .toFile(fallbackPath);
      
      return fallbackPath;
    }
  }
}

export const imageEnhancer = new ImageEnhancer();