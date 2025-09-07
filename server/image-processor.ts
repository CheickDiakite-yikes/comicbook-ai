import sharp from "sharp";
import fs from "fs";
import path from "path";

export interface ImageProcessingOptions {
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'entropy' | 'attention';
  background?: { r: number; g: number; b: number; alpha?: number };
}

export class ImageProcessor {
  /**
   * Process an image to fit exact panel dimensions
   * This ensures no white borders and proper filling of the panel space
   */
  async processImageForPanel(
    inputPath: string,
    outputPath: string,
    options: ImageProcessingOptions
  ): Promise<string> {
    try {
      const { width, height, fit = 'cover', position = 'center' } = options;
      
      // Read the image
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error("Could not read image dimensions");
      }
      
      // Calculate aspect ratios
      const sourceAspectRatio = metadata.width / metadata.height;
      const targetAspectRatio = width / height;
      
      console.log(`Processing image: Source AR: ${sourceAspectRatio.toFixed(2)}, Target AR: ${targetAspectRatio.toFixed(2)}`);
      console.log(`Target dimensions: ${width}x${height}`);
      
      // Process the image with smart cropping to fit panel exactly
      await image
        .resize(width, height, {
          fit: fit,
          position: position,
          // Use smart cropping to keep important content
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false, // Allow enlargement if needed
        })
        .toFormat('png', {
          quality: 95,
          compressionLevel: 9,
        })
        .toFile(outputPath);
      
      console.log(`Image processed successfully: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("Error processing image:", error);
      throw error;
    }
  }
  
  /**
   * Extract the central portion of an image to remove borders
   * Useful for removing white borders from AI-generated images
   */
  async extractCentralContent(
    inputPath: string,
    outputPath: string,
    cropPercentage: number = 0.95 // Crop to 95% of original to remove borders
  ): Promise<string> {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error("Could not read image dimensions");
      }
      
      // Calculate crop dimensions
      const cropWidth = Math.floor(metadata.width * cropPercentage);
      const cropHeight = Math.floor(metadata.height * cropPercentage);
      const left = Math.floor((metadata.width - cropWidth) / 2);
      const top = Math.floor((metadata.height - cropHeight) / 2);
      
      // Extract central portion
      await image
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .toFile(outputPath);
      
      console.log(`Extracted central ${cropPercentage * 100}% of image`);
      return outputPath;
    } catch (error) {
      console.error("Error extracting central content:", error);
      throw error;
    }
  }
  
  /**
   * Smart crop to remove white borders by detecting edges
   * Enhanced with more aggressive border detection
   */
  async smartCropWhiteBorders(
    inputPath: string,
    outputPath: string,
    threshold: number = 240 // RGB values above this are considered "white"
  ): Promise<string> {
    try {
      const image = sharp(inputPath);
      
      // More aggressive trim - try multiple approaches
      // First attempt: trim with higher threshold for better border detection
      await image
        .trim({
          background: { r: 255, g: 255, b: 255 },
          threshold: 30, // Increased threshold to catch more border variations
        })
        .toFile(outputPath);
      
      console.log(`Smart cropped white borders from image with threshold 30`);
      return outputPath;
    } catch (error) {
      console.error("Error smart cropping, trying aggressive crop:", error);
      // If smart crop fails, use more aggressive central extraction
      console.log("Using aggressive central extraction method");
      return this.extractCentralContent(inputPath, outputPath, 0.92); // More aggressive crop
    }
  }
  
  /**
   * Process image for a specific panel with automatic border removal and fitting
   * Enhanced with zoom to ensure full panel coverage
   */
  async processForComicPanel(
    inputPath: string,
    panelWidth: number,
    panelHeight: number,
    panelNumber: number
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const tempPath = path.join(path.dirname(inputPath), `temp_${timestamp}.png`);
      const tempPath2 = path.join(path.dirname(inputPath), `temp2_${timestamp}.png`);
      const finalPath = path.join(path.dirname(inputPath), `panel_${panelNumber}_processed_${timestamp}.png`);
      
      // Step 1: Remove white borders aggressively
      await this.smartCropWhiteBorders(inputPath, tempPath);
      
      // Step 2: Apply slight zoom (105%) to ensure full coverage
      // This helps eliminate any remaining edge artifacts
      const zoomFactor = 1.05;
      const zoomedWidth = Math.round(panelWidth * zoomFactor);
      const zoomedHeight = Math.round(panelHeight * zoomFactor);
      
      // First resize with zoom
      await this.processImageForPanel(tempPath, tempPath2, {
        width: zoomedWidth,
        height: zoomedHeight,
        fit: 'cover',
        position: 'center', // Center for initial zoom
      });
      
      // Step 3: Final crop to exact panel dimensions
      const finalImage = sharp(tempPath2);
      const cropLeft = Math.round((zoomedWidth - panelWidth) / 2);
      const cropTop = Math.round((zoomedHeight - panelHeight) / 2);
      
      await finalImage
        .extract({
          left: cropLeft,
          top: cropTop,
          width: panelWidth,
          height: panelHeight
        })
        .toFile(finalPath);
      
      // Clean up temp files
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      if (fs.existsSync(tempPath2)) {
        fs.unlinkSync(tempPath2);
      }
      
      console.log(`Processed panel ${panelNumber} with zoom factor ${zoomFactor}`);
      return finalPath;
    } catch (error) {
      console.error(`Error processing image for panel ${panelNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate optimal panel dimensions based on layout and page size
   */
  calculatePanelPixelDimensions(
    panel: { x: number; y: number; width: number; height: number },
    pageWidth: number = 850,
    pageHeight: number = 1100
  ): { width: number; height: number } {
    // Calculate actual pixel dimensions based on panel's relative position
    const width = Math.round(panel.width * pageWidth);
    const height = Math.round(panel.height * pageHeight);
    
    return { width, height };
  }
}

export const imageProcessor = new ImageProcessor();