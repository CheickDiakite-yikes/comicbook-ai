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
];
