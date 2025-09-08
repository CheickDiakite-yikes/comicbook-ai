export interface ComicLayout {
  id: string;
  name: string;
  description: string;
  svg: string;
  panelCount: number;
  panels: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export const comicLayouts: ComicLayout[] = [
  {
    id: "classic-grid",
    name: "Perfect Squares",
    description: "4 panels - Google's 1:1 format",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.025, width: 0.46, height: 0.46 },    // 1:1 (Google native)
      { x: 0.515, y: 0.025, width: 0.46, height: 0.46 },   // 1:1 (Google native)
      { x: 0.025, y: 0.515, width: 0.46, height: 0.46 },   // 1:1 (Google native)
      { x: 0.515, y: 0.515, width: 0.46, height: 0.46 },   // 1:1 (Google native)
    ],
  },
  {
    id: "hero-panel",
    name: "Widescreen Hero",
    description: "3 panels - Google's 16:9 + squares",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="70" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="70" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.3 },     // 16:9 (Google native)
      { x: 0.025, y: 0.35, width: 0.46, height: 0.46 },   // 1:1 (Google native)
      { x: 0.515, y: 0.35, width: 0.46, height: 0.46 },   // 1:1 (Google native)
    ],
  },
  {
    id: "quad-plus",
    name: "Fullscreen Strip", 
    description: "3 panels - Google's 4:3 format",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="45" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="65" width="180" height="45" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="120" width="180" height="45" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.3 },    // 4:3 (Google native)
      { x: 0.025, y: 0.34, width: 0.95, height: 0.3 },   // 4:3 (Google native)
      { x: 0.025, y: 0.66, width: 0.95, height: 0.3 },   // 4:3 (Google native)
    ],
  },
  {
    id: "dynamic-split",
    name: "Portrait Trio",
    description: "3 panels - Google's 3:4 portrait",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="54" height="72" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="73" y="10" width="54" height="72" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="136" y="10" width="54" height="72" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.305, height: 0.6 },   // 3:4 (Google native)
      { x: 0.3475, y: 0.02, width: 0.305, height: 0.6 }, // 3:4 (Google native)
      { x: 0.67, y: 0.02, width: 0.305, height: 0.6 },   // 3:4 (Google native)
    ],
  },
  {
    id: "wide-focus",
    name: "Tall Portrait",
    description: "2 panels - Google's 9:16 vertical", 
    panelCount: 2,
    svg: `<svg xmlns="http://www.w3.0/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="151" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="151" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.46, height: 0.94 },   // 9:16 (Google native)
      { x: 0.515, y: 0.02, width: 0.46, height: 0.94 },  // 9:16 (Google native)
    ],
  },
  {
    id: "four-square",
    name: "Perfect Squares",
    description: "4 panels - 1:1 square format",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.025, width: 0.46, height: 0.46 },   // 1:1 square
      { x: 0.515, y: 0.025, width: 0.46, height: 0.46 },  // 1:1 square
      { x: 0.025, y: 0.515, width: 0.46, height: 0.46 },  // 1:1 square
      { x: 0.515, y: 0.515, width: 0.46, height: 0.46 },  // 1:1 square
    ],
  },
  {
    id: "sandwich",
    name: "Mixed Google",
    description: "4 panels - Google's native formats",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="45" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="65" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="65" width="85" height="113" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="160" width="85" height="24" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.25 },   // 4:3 (Google native)
      { x: 0.025, y: 0.3, width: 0.46, height: 0.46 },   // 1:1 (Google native)
      { x: 0.515, y: 0.3, width: 0.46, height: 0.62 },   // 3:4 (Google native)
      { x: 0.025, y: 0.79, width: 0.46, height: 0.17 },  // 16:9 (Google native)
    ],
  },
  {
    id: "full-splash",
    name: "Full Splash",
    description: "1 panel - maximum impact",
    panelCount: 1,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="180" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.94 },   // Full splash
    ],
  },
  {
    id: "side-by-side",
    name: "Side by Side", 
    description: "2 panels - equal horizontal split",
    panelCount: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="88" height="180" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="102" y="10" width="88" height="180" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.47, height: 0.96 },
      { x: 0.505, y: 0.02, width: 0.47, height: 0.96 },
    ],
  },
  {
    id: "top-bottom",
    name: "Top Bottom",
    description: "2 panels - stacked vertically", 
    panelCount: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="88" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="102" width="180" height="88" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.47 },
      { x: 0.025, y: 0.505, width: 0.95, height: 0.47 },
    ],
  },
  {
    id: "vertical-stack",
    name: "Vertical Stack",
    description: "3 panels - horizontal strips",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="72" width="180" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="134" width="180" height="56" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.3 },
      { x: 0.025, y: 0.34, width: 0.95, height: 0.3 },
      { x: 0.025, y: 0.66, width: 0.95, height: 0.3 },
    ],
  },
  {
    id: "l-shape",
    name: "L-Shape",
    description: "3 panels - one large + two small",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="120" height="120" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="138" y="10" width="52" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="138" y="74" width="52" height="56" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.6, height: 0.62 },   // Large panel
      { x: 0.645, y: 0.02, width: 0.33, height: 0.3 },   // Small top
      { x: 0.645, y: 0.34, width: 0.33, height: 0.3 },   // Small bottom
    ],
  },
  {
    id: "triangle-flow",
    name: "Triangle Flow",
    description: "3 panels - dynamic triangle layout",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="60" y="10" width="80" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="70" width="85" height="120" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="70" width="85" height="120" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.3, y: 0.02, width: 0.4, height: 0.28 },     // Top center
      { x: 0.025, y: 0.32, width: 0.46, height: 0.66 },  // Bottom left
      { x: 0.515, y: 0.32, width: 0.46, height: 0.66 },  // Bottom right
    ],
  },
  {
    id: "step-down",
    name: "Step Down",
    description: "3 panels - descending staircase",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="80" y="40" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="40" y="110" width="150" height="80" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.32, height: 0.32 },   // Top left
      { x: 0.38, y: 0.18, width: 0.32, height: 0.32 },    // Middle right
      { x: 0.18, y: 0.56, width: 0.8, height: 0.42 },     // Large bottom
    ],
  },
  {
    id: "spotlight",
    name: "Spotlight",
    description: "3 panels - center focus design",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="60" y="60" width="80" height="80" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="150" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.22 },   // Top wide
      { x: 0.28, y: 0.28, width: 0.44, height: 0.44 },    // Center square
      { x: 0.025, y: 0.76, width: 0.95, height: 0.22 },   // Bottom wide
    ],
  },
  {
    id: "side-hero",
    name: "Side Hero",
    description: "3 panels - vertical hero + two stack",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="90" height="180" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="110" y="10" width="80" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="110" y="105" width="80" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.47, height: 0.96 },   // Large left
      { x: 0.52, y: 0.02, width: 0.455, height: 0.46 },   // Top right
      { x: 0.52, y: 0.52, width: 0.455, height: 0.46 },   // Bottom right
    ],
  },
  {
    id: "brick-pattern",
    name: "Brick Pattern", 
    description: "4 panels - staggered layout",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="88" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="102" y="10" width="88" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="35" y="72" width="60" height="118" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="72" width="85" height="118" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.47, height: 0.3 },   // Top left
      { x: 0.505, y: 0.02, width: 0.47, height: 0.3 },   // Top right
      { x: 0.15, y: 0.34, width: 0.32, height: 0.64 },   // Bottom left (offset)
      { x: 0.505, y: 0.34, width: 0.47, height: 0.64 },  // Bottom right
    ],
  },
  {
    id: "hero-bottom",
    name: "Hero Bottom",
    description: "4 panels - three small + one large",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="72" y="10" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="134" y="10" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="72" width="180" height="118" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.305, height: 0.3 },  // Top left
      { x: 0.3475, y: 0.02, width: 0.305, height: 0.3 }, // Top center
      { x: 0.67, y: 0.02, width: 0.305, height: 0.3 },   // Top right
      { x: 0.025, y: 0.34, width: 0.95, height: 0.64 },  // Large bottom
    ],
  },
  {
    id: "pentagon",
    name: "Pentagon",
    description: "5 panels - center + four corners",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="134" y="10" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="72" y="35" width="56" height="130" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="134" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="134" y="134" width="56" height="56" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.305, height: 0.3 },   // Top left
      { x: 0.67, y: 0.02, width: 0.305, height: 0.3 },    // Top right
      { x: 0.3475, y: 0.15, width: 0.305, height: 0.7 },  // Center tall
      { x: 0.025, y: 0.66, width: 0.305, height: 0.32 },  // Bottom left
      { x: 0.67, y: 0.66, width: 0.305, height: 0.32 },   // Bottom right
    ],
  },
  {
    id: "staircase",
    name: "Staircase",
    description: "5 panels - stepped diagonal layout", 
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="36" width="85" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="62" width="85" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="88" width="85" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="114" width="180" height="76" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.46, height: 0.2 },    // Step 1
      { x: 0.515, y: 0.16, width: 0.46, height: 0.2 },    // Step 2 
      { x: 0.025, y: 0.3, width: 0.46, height: 0.2 },     // Step 3
      { x: 0.515, y: 0.44, width: 0.46, height: 0.2 },    // Step 4
      { x: 0.025, y: 0.58, width: 0.95, height: 0.4 },    // Large bottom
    ],
  },
  {
    id: "strip-plus",
    name: "Strip Plus",
    description: "5 panels - horizontal flow + bottom",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="42" height="35" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="57" y="10" width="42" height="35" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="104" y="10" width="42" height="35" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="151" y="10" width="39" height="35" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="50" width="180" height="65" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.225, height: 0.25 },   // Top strip panel 1
      { x: 0.265, y: 0.02, width: 0.225, height: 0.25 },   // Top strip panel 2
      { x: 0.505, y: 0.02, width: 0.225, height: 0.25 },   // Top strip panel 3
      { x: 0.745, y: 0.02, width: 0.225, height: 0.25 },   // Top strip panel 4
      { x: 0.025, y: 0.29, width: 0.95, height: 0.68 },    // Large bottom panel
    ],
  },
  {
    id: "cross-layout",
    name: "Cross Focus",
    description: "5 panels - hero panel + corners",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="70" width="42" height="42" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="57" y="70" width="86" height="120" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="148" y="70" width="42" height="42" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="117" width="42" height="73" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.95, height: 0.28 },    // Top hero panel
      { x: 0.025, y: 0.32, width: 0.225, height: 0.32 },   // Left middle
      { x: 0.265, y: 0.32, width: 0.47, height: 0.66 },    // Center large panel
      { x: 0.745, y: 0.32, width: 0.225, height: 0.32 },   // Right middle
      { x: 0.025, y: 0.66, width: 0.225, height: 0.32 },   // Left bottom
    ],
  },
  {
    id: "classic-grid-6",
    name: "Classic Grid",
    description: "6 panels - traditional 2x3 grid",
    panelCount: 6,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="72" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="72" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="134" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="134" width="85" height="56" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.46, height: 0.3 },   // Top left
      { x: 0.515, y: 0.02, width: 0.46, height: 0.3 },   // Top right
      { x: 0.025, y: 0.34, width: 0.46, height: 0.3 },   // Middle left
      { x: 0.515, y: 0.34, width: 0.46, height: 0.3 },   // Middle right
      { x: 0.025, y: 0.66, width: 0.46, height: 0.32 },  // Bottom left
      { x: 0.515, y: 0.66, width: 0.46, height: 0.32 },  // Bottom right
    ],
  },
  {
    id: "hero-surround",
    name: "Hero Surround",
    description: "6 panels - large center + 5 around",
    panelCount: 6,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="56" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="72" y="10" width="56" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="134" y="10" width="56" height="36" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="52" width="36" height="96" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="52" y="52" width="96" height="96" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="154" y="52" width="36" height="96" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.305, height: 0.2 },   // Top left
      { x: 0.3475, y: 0.02, width: 0.305, height: 0.2 },  // Top center
      { x: 0.67, y: 0.02, width: 0.305, height: 0.2 },    // Top right
      { x: 0.025, y: 0.24, width: 0.2, height: 0.52 },    // Left side
      { x: 0.245, y: 0.24, width: 0.51, height: 0.52 },   // Large center
      { x: 0.775, y: 0.24, width: 0.2, height: 0.52 },    // Right side
    ],
  },
  {
    id: "zigzag-flow",
    name: "Zigzag Flow", 
    description: "6 panels - alternating flow pattern",
    panelCount: 6,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="28" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="44" width="85" height="28" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="78" width="85" height="28" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="112" width="85" height="28" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="146" width="85" height="28" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="180" width="85" height="20" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0.025, y: 0.02, width: 0.46, height: 0.16 },   // Top left
      { x: 0.515, y: 0.2, width: 0.46, height: 0.16 },    // Offset right
      { x: 0.025, y: 0.38, width: 0.46, height: 0.16 },   // Left again
      { x: 0.515, y: 0.56, width: 0.46, height: 0.16 },   // Right again
      { x: 0.025, y: 0.74, width: 0.46, height: 0.16 },   // Left final
      { x: 0.515, y: 0.92, width: 0.46, height: 0.06 },   // Small right end
    ],
  },
];
