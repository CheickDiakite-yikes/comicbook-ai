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
    description: "5 panels - great for dialogue scenes",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="105" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="155" width="85" height="35" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="155" width="85" height="35" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.425, height: 0.425 },
      { x: 0.525, y: 0, width: 0.425, height: 0.425 },
      { x: 0, y: 0.525, width: 0.9, height: 0.2 },
      { x: 0, y: 0.775, width: 0.425, height: 0.175 },
      { x: 0.525, y: 0.775, width: 0.425, height: 0.175 },
    ],
  },
  {
    id: "hero-panel",
    name: "Hero Panel",
    description: "4 panels - perfect for action sequences",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="80" width="85" height="110" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="80" width="85" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="140" width="85" height="50" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.3 },
      { x: 0, y: 0.4, width: 0.425, height: 0.55 },
      { x: 0.525, y: 0.4, width: 0.425, height: 0.25 },
      { x: 0.525, y: 0.7, width: 0.425, height: 0.25 },
    ],
  },
  {
    id: "quad-plus",
    name: "Quad Plus", 
    description: "5 panels - balanced storytelling",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="80" width="85" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="80" width="85" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="150" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.425, height: 0.3 },
      { x: 0.525, y: 0, width: 0.425, height: 0.3 },
      { x: 0, y: 0.4, width: 0.425, height: 0.3 },
      { x: 0.525, y: 0.4, width: 0.425, height: 0.3 },
      { x: 0, y: 0.75, width: 0.9, height: 0.2 },
    ],
  },
  {
    id: "dynamic-split",
    name: "Dynamic Split",
    description: "2 panels - dramatic reveals",
    panelCount: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="180" fill="none" stroke="#666" stroke-width="2"/>
      <line x1="40" y1="40" x2="160" y2="160" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.6, height: 0.6 },
      { x: 0.4, y: 0.4, width: 0.6, height: 0.6 },
    ],
  },
  {
    id: "wide-focus",
    name: "Wide Focus",
    description: "5 panels - cinematic feel", 
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="80" y="10" width="110" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="80" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="80" y="80" width="110" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="150" width="180" height="40" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.3, height: 0.3 },
      { x: 0.4, y: 0, width: 0.55, height: 0.3 },
      { x: 0, y: 0.4, width: 0.3, height: 0.3 },
      { x: 0.4, y: 0.4, width: 0.55, height: 0.3 },
      { x: 0, y: 0.75, width: 0.9, height: 0.2 },
    ],
  },
  {
    id: "four-square",
    name: "Four Square",
    description: "4 panels - clean and simple",
    panelCount: 4,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="10" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="105" y="105" width="85" height="85" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.425, height: 0.425 },
      { x: 0.525, y: 0, width: 0.425, height: 0.425 },
      { x: 0, y: 0.525, width: 0.425, height: 0.425 },
      { x: 0.525, y: 0.525, width: 0.425, height: 0.425 },
    ],
  },
  {
    id: "sandwich",
    name: "Sandwich",
    description: "5 panels - narrative flow",
    panelCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="10" y="10" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="70" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="80" y="70" width="60" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="150" y="70" width="40" height="60" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="10" y="140" width="180" height="50" fill="none" stroke="#666" stroke-width="2"/>
    </svg>`,
    panels: [
      { x: 0, y: 0, width: 0.9, height: 0.25 },
      { x: 0, y: 0.35, width: 0.3, height: 0.3 },
      { x: 0.4, y: 0.35, width: 0.3, height: 0.3 },
      { x: 0.75, y: 0.35, width: 0.2, height: 0.3 },
      { x: 0, y: 0.7, width: 0.9, height: 0.25 },
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
