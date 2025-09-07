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
      { x: 0, y: 0, width: 0.45, height: 0.45 },       // 1:1 (Google native)
      { x: 0.55, y: 0, width: 0.45, height: 0.45 },     // 1:1 (Google native)
      { x: 0, y: 0.55, width: 0.45, height: 0.45 },     // 1:1 (Google native)
      { x: 0.55, y: 0.55, width: 0.45, height: 0.45 },  // 1:1 (Google native)
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
      { x: 0, y: 0, width: 0.9, height: 0.253 },        // 16:9 (Google native)
      { x: 0, y: 0.35, width: 0.45, height: 0.45 },     // 1:1 (Google native)
      { x: 0.55, y: 0.35, width: 0.45, height: 0.45 },  // 1:1 (Google native)
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
      { x: 0, y: 0, width: 0.9, height: 0.27 },         // 4:3 (Google native)
      { x: 0, y: 0.32, width: 0.9, height: 0.27 },      // 4:3 (Google native)
      { x: 0, y: 0.64, width: 0.9, height: 0.27 },      // 4:3 (Google native)
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
      { x: 0, y: 0, width: 0.3, height: 0.4 },          // 3:4 (Google native)
      { x: 0.35, y: 0, width: 0.3, height: 0.4 },       // 3:4 (Google native)
      { x: 0.7, y: 0, width: 0.3, height: 0.4 },        // 3:4 (Google native)
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
      { x: 0, y: 0, width: 0.45, height: 0.8 },         // 9:16 (Google native)
      { x: 0.55, y: 0, width: 0.45, height: 0.8 },      // 9:16 (Google native)
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
      { x: 0, y: 0, width: 0.45, height: 0.45 },       // 1:1 square
      { x: 0.55, y: 0, width: 0.45, height: 0.45 },     // 1:1 square
      { x: 0, y: 0.55, width: 0.45, height: 0.45 },     // 1:1 square
      { x: 0.55, y: 0.55, width: 0.45, height: 0.45 },  // 1:1 square
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
      { x: 0, y: 0, width: 0.9, height: 0.27 },         // 4:3 (Google native)
      { x: 0, y: 0.32, width: 0.45, height: 0.45 },     // 1:1 (Google native)
      { x: 0.55, y: 0.32, width: 0.45, height: 0.6 },   // 3:4 (Google native)
      { x: 0, y: 0.82, width: 0.45, height: 0.127 },    // 16:9 (Google native)
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
      { x: 0, y: 0, width: 0.9, height: 0.9 },
    ],
  },
];
