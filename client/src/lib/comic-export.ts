import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { comicLayouts } from './comic-layouts';

export interface ExportPage {
  id: string;
  pageNumber: number;
  title: string;
  layoutTemplate: string;
  backgroundImageUrl?: string;
}

export interface ExportPanel {
  id: string;
  pageId: string;
  panelNumber: number;
  imageUrl: string;
  action: string;
}

/**
 * Export a single page as high-quality PNG
 */
export async function exportPageAsImage(
  pageElement: HTMLElement,
  pageTitle: string
): Promise<void> {
  try {
    const canvas = await html2canvas(pageElement, {
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: pageElement.offsetWidth,
      height: pageElement.offsetHeight
    });

    // Create download link
    const link = document.createElement('a');
    link.download = `${pageTitle}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Failed to export page as image:', error);
    throw error;
  }
}

/**
 * Create a clean page element for export (without UI elements)
 */
function createExportPageElement(
  page: ExportPage,
  panels: ExportPanel[],
  generatedImages: {[key: number]: string},
  generatedBackgrounds: {[key: number]: string},
  pageBackground?: string
): HTMLDivElement {
  const layout = comicLayouts.find(l => l.id === page.layoutTemplate) || comicLayouts[0];
  
  // Create page container
  const pageDiv = document.createElement('div');
  pageDiv.style.cssText = `
    width: 850px;
    height: 1100px;
    position: relative;
    background: white;
    ${pageBackground ? `background-image: url(${pageBackground});` : ''}
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  `;

  // Add panels
  layout.panels.forEach((layoutPanel, index) => {
    const panelNumber = index + 1;
    const panel = panels.find(p => p.panelNumber === panelNumber);
    const hasImage = generatedImages[panelNumber];
    const hasBackground = generatedBackgrounds[panelNumber];
    
    if (!panel && !hasImage && !hasBackground) return; // Skip empty panels
    
    const panelDiv = document.createElement('div');
    panelDiv.style.cssText = `
      position: absolute;
      left: ${layoutPanel.x * 100}%;
      top: ${layoutPanel.y * 100}%;
      width: ${layoutPanel.width * 100}%;
      height: ${layoutPanel.height * 100}%;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
    `;

    if (hasImage) {
      const img = document.createElement('img');
      img.src = hasImage;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      `;
      panelDiv.appendChild(img);
    } else if (hasBackground) {
      panelDiv.style.backgroundImage = `url(${hasBackground})`;
      panelDiv.style.backgroundSize = 'cover';
      panelDiv.style.backgroundPosition = 'center';
      panelDiv.style.backgroundRepeat = 'no-repeat';
    }

    pageDiv.appendChild(panelDiv);
  });

  return pageDiv;
}

/**
 * Export entire comic as PDF
 */
export async function exportComicAsPDF(
  pages: ExportPage[],
  allPanels: ExportPanel[],
  generatedImagesMap: {[pageId: string]: {[panelNumber: number]: string}},
  generatedBackgroundsMap: {[pageId: string]: {[panelNumber: number]: string}},
  pageBackgroundsMap: {[pageId: string]: string},
  projectTitle: string
): Promise<void> {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [850, 1100] // Standard comic book dimensions
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pagePanels = allPanels.filter(p => p.pageId === page.id);
      const generatedImages = generatedImagesMap[page.id] || {};
      const generatedBackgrounds = generatedBackgroundsMap[page.id] || {};
      const pageBackground = pageBackgroundsMap[page.id];

      // Create temporary element for this page
      const tempPageElement = createExportPageElement(
        page,
        pagePanels,
        generatedImages,
        generatedBackgrounds,
        pageBackground
      );

      // Add to document temporarily (required for html2canvas)
      tempPageElement.style.position = 'fixed';
      tempPageElement.style.left = '-9999px';
      tempPageElement.style.top = '0';
      document.body.appendChild(tempPageElement);

      try {
        // Wait for images to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Capture page
        const canvas = await html2canvas(tempPageElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 850,
          height: 1100
        });

        // Add page to PDF
        if (i > 0) pdf.addPage();
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 850, 1100);

      } finally {
        // Clean up temporary element
        document.body.removeChild(tempPageElement);
      }
    }

    // Download PDF
    const filename = `${projectTitle || 'Comic'}.pdf`;
    pdf.save(filename);
    
  } catch (error) {
    console.error('Failed to export comic as PDF:', error);
    throw error;
  }
}

/**
 * Export current page only
 */
export async function exportCurrentPage(
  pageElement: HTMLElement,
  page: ExportPage,
  projectTitle: string,
  format: 'png' | 'pdf' = 'png'
): Promise<void> {
  try {
    if (format === 'png') {
      await exportPageAsImage(pageElement, `${projectTitle || 'Comic'} - Page ${page.pageNumber}`);
    } else {
      // For single page PDF
      const canvas = await html2canvas(pageElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      
      const filename = `${projectTitle || 'Comic'} - Page ${page.pageNumber}.pdf`;
      pdf.save(filename);
    }
  } catch (error) {
    console.error('Failed to export current page:', error);
    throw error;
  }
}