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
    name: "Classic Grid",
    description: "4 panels - standard 1:1 squares",
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
    id: "hero-panel",
    name: "Hero Panel",
    description: "3 panels - cinematic wide + squares",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="56" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="76" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="76" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.3 },          // 16:9 cinematic
      { x: 0, y: 0.4, width: 0.45, height: 0.45 },      // 1:1 square
      { x: 0.55, y: 0.4, width: 0.45, height: 0.45 },   // 1:1 square
    ],
  },
  {
    id: "quad-plus",
    name: "Standard Horizontal", 
    description: "3 panels - 3:2 horizontal format",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="70" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="130" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.3 },          // 3:2 horizontal
      { x: 0, y: 0.35, width: 0.9, height: 0.3 },       // 3:2 horizontal
      { x: 0, y: 0.7, width: 0.9, height: 0.3 },        // 3:2 horizontal
    ],
  },
  {
    id: "dynamic-split",
    name: "Vertical Focus",
    description: "3 panels - 2:3 vertical format",
    panelCount: 3,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="56" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="72" y="10" width="56" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="134" y="10" width="56" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.3, height: 0.45 },         // 2:3 vertical
      { x: 0.35, y: 0, width: 0.3, height: 0.45 },      // 2:3 vertical  
      { x: 0.7, y: 0, width: 0.3, height: 0.45 },       // 2:3 vertical
    ],
  },
  {
    id: "wide-focus",
    name: "Mixed Layout",
    description: "5 panels - varied standard ratios", 
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="58" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="58" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="151" width="85" height="39" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="151" width="85" height="39" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.2 },          // Wide 16:9
      { x: 0, y: 0.25, width: 0.45, height: 0.45 },     // 1:1 square
      { x: 0.55, y: 0.25, width: 0.45, height: 0.45 },  // 1:1 square
      { x: 0, y: 0.75, width: 0.45, height: 0.2 },      // 3:2 horizontal
      { x: 0.55, y: 0.75, width: 0.45, height: 0.2 },   // 3:2 horizontal
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
    name: "Golden Ratio",
    description: "2 panels - 1.618:1 golden ratio",
    panelCount: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="105" width="180" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.45 },         // Golden ratio 1.618:1
      { x: 0, y: 0.55, width: 0.9, height: 0.45 },      // Golden ratio 1.618:1
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
