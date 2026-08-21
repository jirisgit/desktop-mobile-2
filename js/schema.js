/* ==========================================================================
   schema.js — the single declarative description of every setting.
   The panel (desktop) and the sheet (mobile) are both rendered from this,
   which is why they can never drift apart.
   ========================================================================== */

export const ASPECTS = {
  '1:1':  { w: 1080, h: 1080, label: '1:1'  },
  '4:5':  { w: 1080, h: 1350, label: '4:5'  },
  '9:16': { w: 1080, h: 1920, label: '9:16' },
  '16:9': { w: 1920, h: 1080, label: '16:9' },
};

export const PALETTE = [
  '#0b0c0e', '#1d2129', '#3a4256', '#6c7cff', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#ffffff',
];

/* ---------------------------------------------------------------- schema */

export const CATEGORIES = [
  {
    id: 'canvas',
    label: 'Canvas',
    icon: 'i-frame',
    groups: [
      {
        label: 'Format',
        fields: [
          { id: 'aspect', label: 'Aspect ratio', type: 'seg', default: '1:1', variant: 'ratio',
            options: [
              { value: '1:1',  label: '1:1',  box: [16, 16] },
              { value: '4:5',  label: '4:5',  box: [13, 16] },
              { value: '9:16', label: '9:16', box: [9, 16] },
              { value: '16:9', label: '16:9', box: [16, 9] },
            ] },
          { id: 'padding', label: 'Inner padding', type: 'slider', default: 8, min: 0, max: 30, step: 1, unit: '%' },
          { id: 'radius', label: 'Corner radius', type: 'slider', default: 0, min: 0, max: 50, step: 1, unit: '%' },
        ],
      },
      {
        label: 'Background',
        fields: [
          { id: 'bgMode', label: 'Fill', type: 'seg', default: 'gradient',
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'none', label: 'None' },
            ] },
          { id: 'bg1', label: 'Color', type: 'color', default: '#12141a', when: s => s.bgMode === 'solid' },
          { id: 'bg1', key: 'bg1g', label: 'From', type: 'color', default: '#12141a', when: s => s.bgMode === 'gradient' },
          { id: 'bg2', label: 'To', type: 'color', default: '#2b2160', when: s => s.bgMode === 'gradient' },
          { id: 'bgAngle', label: 'Angle', type: 'slider', default: 135, min: 0, max: 360, step: 5, unit: '°',
            when: s => s.bgMode === 'gradient' },
          { id: 'bgSoft', label: 'Soft light', type: 'slider', default: 30, min: 0, max: 100, step: 1, unit: '%',
            hint: 'Radial glow layered over the fill', when: s => s.bgMode !== 'none' },
        ],
      },
    ],
  },

  {
    id: 'layout',
    label: 'Layout',
    icon: 'i-grid',
    groups: [
      {
        label: 'Arrangement',
        fields: [
          { id: 'arrange', label: 'Mode', type: 'seg', default: 'grid',
            options: [
              { value: 'grid', label: 'Grid' },
              { value: 'ring', label: 'Ring' },
              { value: 'scatter', label: 'Scatter' },
            ] },
          { id: 'count', label: 'Count', type: 'slider', default: 12, min: 1, max: 64, step: 1 },
          { id: 'cols', label: 'Columns', type: 'slider', default: 4, min: 1, max: 12, step: 1,
            when: s => s.arrange === 'grid' },
          { id: 'gap', label: 'Gap', type: 'slider', default: 24, min: 0, max: 100, step: 1, unit: '%',
            when: s => s.arrange === 'grid' },
          { id: 'ringR', label: 'Ring radius', type: 'slider', default: 34, min: 5, max: 50, step: 1, unit: '%',
            when: s => s.arrange === 'ring' },
          { id: 'ringSpin', label: 'Ring offset', type: 'slider', default: 0, min: 0, max: 360, step: 5, unit: '°',
            when: s => s.arrange === 'ring' },
          { id: 'jitter', label: 'Jitter', type: 'slider', default: 0, min: 0, max: 100, step: 1, unit: '%',
            hint: 'Random offset applied per element' },
        ],
      },
      {
        label: 'Placement',
        fields: [
          { id: 'origin', label: 'Origin', type: 'xy', default: { x: 50, y: 50 },
            hint: 'Drag to move the composition' },
          { id: 'scale', label: 'Group scale', type: 'slider', default: 100, min: 20, max: 160, step: 1, unit: '%' },
          { id: 'seed', label: 'Seed', type: 'slider', default: 42, min: 1, max: 999, step: 1 },
        ],
      },
    ],
  },

  {
    id: 'shape',
    label: 'Shape',
    icon: 'i-shape',
    groups: [
      {
        label: 'Geometry',
        fields: [
          { id: 'shape', label: 'Form', type: 'seg', default: 'circle', variant: 'grid',
            options: [
              { value: 'circle', label: 'Circle' },
              { value: 'square', label: 'Square' },
              { value: 'triangle', label: 'Triangle' },
              { value: 'hexagon', label: 'Hexagon' },
              { value: 'star', label: 'Star' },
              { value: 'cross', label: 'Cross' },
            ] },
          { id: 'size', label: 'Size', type: 'slider', default: 60, min: 4, max: 140, step: 1, unit: '%' },
          { id: 'sizeVar', label: 'Size variance', type: 'slider', default: 0, min: 0, max: 100, step: 1, unit: '%' },
          { id: 'rotate', label: 'Rotation', type: 'slider', default: 0, min: -180, max: 180, step: 1, unit: '°',
            bipolar: true },
          { id: 'rotateVar', label: 'Rotation spread', type: 'slider', default: 0, min: 0, max: 100, step: 1, unit: '%' },
          { id: 'corner', label: 'Corner round', type: 'slider', default: 20, min: 0, max: 50, step: 1, unit: '%',
            when: s => ['square', 'cross'].includes(s.shape) },
        ],
      },
      {
        label: 'Paint',
        fields: [
          { id: 'fillMode', label: 'Fill', type: 'seg', default: 'duo',
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'duo', label: 'Duo' },
              { value: 'ramp', label: 'Ramp' },
            ] },
          { id: 'fill1', label: 'Primary', type: 'color', default: '#6c7cff' },
          { id: 'fill2', label: 'Secondary', type: 'color', default: '#14e3c2',
            when: s => s.fillMode !== 'solid' },
          { id: 'opacity', label: 'Opacity', type: 'slider', default: 100, min: 5, max: 100, step: 1, unit: '%' },
          { id: 'blend', label: 'Blend mode', type: 'select', default: 'source-over',
            options: [
              { value: 'source-over', label: 'Normal' },
              { value: 'multiply', label: 'Multiply' },
              { value: 'screen', label: 'Screen' },
              { value: 'overlay', label: 'Overlay' },
              { value: 'difference', label: 'Difference' },
              { value: 'lighter', label: 'Add' },
            ] },
          { id: 'strokeOn', label: 'Stroke', type: 'switch', default: false },
          { id: 'strokeColor', label: 'Stroke color', type: 'color', default: '#ffffff', when: s => s.strokeOn },
          { id: 'strokeW', label: 'Stroke width', type: 'slider', default: 2, min: 0.5, max: 16, step: 0.5, unit: 'px',
            when: s => s.strokeOn },
        ],
      },
    ],
  },

  {
    id: 'type',
    label: 'Type',
    icon: 'i-type',
    groups: [
      {
        label: 'Content',
        fields: [
          { id: 'textOn', label: 'Show text', type: 'switch', default: true },
          { id: 'text', label: 'Headline', type: 'text', default: 'Responsive by design',
            placeholder: 'Type something…', when: s => s.textOn },
          { id: 'sub', label: 'Subline', type: 'text', default: 'one codebase, two ergonomics',
            placeholder: 'Optional', when: s => s.textOn },
        ],
      },
      {
        label: 'Style',
        when: s => s.textOn,
        fields: [
          { id: 'font', label: 'Typeface', type: 'select', default: 'sans',
            options: [
              { value: 'sans', label: 'Sans' },
              { value: 'serif', label: 'Serif' },
              { value: 'mono', label: 'Mono' },
            ], when: s => s.textOn },
          { id: 'weight', label: 'Weight', type: 'seg', default: '700',
            options: [
              { value: '300', label: 'Light' },
              { value: '500', label: 'Medium' },
              { value: '700', label: 'Bold' },
              { value: '900', label: 'Black' },
            ], when: s => s.textOn },
          { id: 'fontSize', label: 'Size', type: 'slider', default: 9, min: 2, max: 22, step: 0.5, unit: '%',
            when: s => s.textOn },
          { id: 'tracking', label: 'Tracking', type: 'slider', default: -2, min: -8, max: 30, step: 1,
            bipolar: true, when: s => s.textOn },
          { id: 'upper', label: 'Uppercase', type: 'switch', default: false, when: s => s.textOn },
          { id: 'textColor', label: 'Color', type: 'color', default: '#ffffff', when: s => s.textOn },
          { id: 'align', label: 'Align', type: 'seg', default: 'center',
            options: [
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ], when: s => s.textOn },
          { id: 'textY', label: 'Baseline', type: 'slider', default: 84, min: 5, max: 95, step: 1, unit: '%',
            when: s => s.textOn },
        ],
      },
    ],
  },

  {
    id: 'fx',
    label: 'Effects',
    icon: 'i-fx',
    groups: [
      {
        label: 'Light',
        fields: [
          { id: 'blur', label: 'Blur', type: 'slider', default: 0, min: 0, max: 40, step: 0.5, unit: 'px' },
          { id: 'glowOn', label: 'Glow', type: 'switch', default: true },
          { id: 'glow', label: 'Glow amount', type: 'slider', default: 26, min: 0, max: 100, step: 1, unit: '%',
            when: s => s.glowOn },
          { id: 'glowColor', label: 'Glow color', type: 'color', default: '#6c7cff', when: s => s.glowOn },
        ],
      },
      {
        label: 'Surface',
        fields: [
          { id: 'grain', label: 'Grain', type: 'slider', default: 12, min: 0, max: 100, step: 1, unit: '%' },
          { id: 'vignette', label: 'Vignette', type: 'slider', default: 20, min: 0, max: 100, step: 1, unit: '%' },
          { id: 'tintOn', label: 'Color wash', type: 'switch', default: false },
          { id: 'tint', label: 'Wash color', type: 'color', default: '#ff8a3d', when: s => s.tintOn },
          { id: 'tintAmt', label: 'Wash amount', type: 'slider', default: 15, min: 0, max: 80, step: 1, unit: '%',
            when: s => s.tintOn },
        ],
      },
    ],
  },

  {
    id: 'export',
    label: 'Export',
    icon: 'i-export',
    groups: [
      {
        label: 'Output',
        fields: [
          { id: 'filename', label: 'File name', type: 'text', default: 'canvas-playground',
            placeholder: 'file name' },
          { id: 'format', label: 'Format', type: 'seg', default: 'png',
            options: [
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPG' },
              { value: 'webp', label: 'WebP' },
            ] },
          { id: 'exScale', label: 'Resolution', type: 'seg', default: '1',
            options: [
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
              { value: '3', label: '3×' },
            ] },
          { id: 'quality', label: 'Quality', type: 'slider', default: 92, min: 40, max: 100, step: 1, unit: '%',
            when: s => s.format !== 'png' },
        ],
      },
      {
        label: 'Workspace',
        fields: [
          { id: 'showGuides', label: 'Safe-area guides', type: 'switch', default: false,
            hint: 'Overlay the crop margins used by social feeds' },
          { id: 'liveRender', label: 'Live preview', type: 'switch', default: true,
            hint: 'Off = redraw only when you release a control' },
          { id: '__note', type: 'note', when: () => true,
            html: 'Export renders at the <b>native pixel size</b> of the chosen aspect ratio — ' +
                  'independent of on-screen zoom or device DPR.' },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------- presets */

export const PRESETS = [
  {
    id: 'aurora', name: 'Aurora', hint: 'Soft gradient, glowing dots',
    values: { aspect: '1:1', bgMode: 'gradient', bg1: '#0d1030', bg2: '#3a1c71', bgAngle: 135, bgSoft: 45,
              arrange: 'grid', count: 16, cols: 4, gap: 30, jitter: 12, shape: 'circle', size: 62,
              sizeVar: 30, fillMode: 'duo', fill1: '#6c7cff', fill2: '#14e3c2', opacity: 90,
              blend: 'screen', blur: 0, glowOn: true, glow: 40, glowColor: '#6c7cff',
              grain: 14, vignette: 26, textOn: true, text: 'Responsive by design', textColor: '#ffffff' },
  },
  {
    id: 'brutal', name: 'Brutalist', hint: 'Hard edges, flat ink',
    values: { aspect: '4:5', bgMode: 'solid', bg1: '#f2efe6', bgSoft: 0, arrange: 'grid', count: 9, cols: 3,
              gap: 14, jitter: 0, shape: 'square', size: 96, sizeVar: 0, corner: 0, rotate: 0,
              fillMode: 'duo', fill1: '#111111', fill2: '#ff4d2e', opacity: 100, blend: 'source-over',
              strokeOn: false, glowOn: false, grain: 6, vignette: 0, blur: 0,
              textOn: true, text: 'GRID SYSTEM', sub: 'no compromise', upper: true, weight: '900',
              textColor: '#111111', fontSize: 11, tracking: -3, align: 'left', textY: 90 },
  },
  {
    id: 'orbit', name: 'Orbit', hint: 'Ring of shapes, deep space',
    values: { aspect: '16:9', bgMode: 'gradient', bg1: '#05060b', bg2: '#101a3a', bgAngle: 200, bgSoft: 55,
              arrange: 'ring', count: 24, ringR: 34, ringSpin: 0, jitter: 6, shape: 'hexagon', size: 26,
              sizeVar: 55, rotate: 0, rotateVar: 80, fillMode: 'ramp', fill1: '#14e3c2', fill2: '#8b5cf6',
              opacity: 85, blend: 'screen', glowOn: true, glow: 55, glowColor: '#14e3c2',
              grain: 18, vignette: 40, textOn: true, text: 'ORBIT', sub: 'ring composition',
              upper: true, tracking: 22, weight: '300', fontSize: 7, align: 'center', textY: 52 },
  },
  {
    id: 'poster', name: 'Story poster', hint: 'Vertical, big type',
    values: { aspect: '9:16', bgMode: 'gradient', bg1: '#ff5f6d', bg2: '#ffc371', bgAngle: 160, bgSoft: 20,
              arrange: 'scatter', count: 18, jitter: 70, shape: 'star', size: 30, sizeVar: 70,
              rotateVar: 100, fillMode: 'solid', fill1: '#ffffff', opacity: 45, blend: 'overlay',
              glowOn: false, grain: 25, vignette: 15, textOn: true, text: 'Golden hour',
              sub: 'swipe up', weight: '700', fontSize: 8, tracking: -2, align: 'center', textY: 70,
              textColor: '#ffffff' },
  },
  {
    id: 'mono', name: 'Monochrome', hint: 'Editorial, restrained',
    values: { aspect: '1:1', bgMode: 'solid', bg1: '#ffffff', bgSoft: 0, arrange: 'grid', count: 36,
              cols: 6, gap: 40, jitter: 0, shape: 'cross', size: 44, sizeVar: 0, corner: 50,
              fillMode: 'solid', fill1: '#111111', opacity: 100, blend: 'source-over',
              glowOn: false, blur: 0, grain: 10, vignette: 0, textOn: true, text: 'Less, but better',
              sub: '', weight: '500', font: 'serif', fontSize: 7, tracking: 0, align: 'center',
              textY: 88, textColor: '#111111' },
  },
];

/* flat map of every field, keyed by state id (first declaration wins) */
export const FIELD_INDEX = (() => {
  const map = new Map();
  for (const cat of CATEGORIES) {
    for (const group of cat.groups) {
      for (const f of group.fields) {
        if (f.type === 'note') continue;
        if (!map.has(f.id)) map.set(f.id, { ...f, category: cat.id });
      }
    }
  }
  return map;
})();

export const DEFAULTS = (() => {
  const out = {};
  for (const [id, f] of FIELD_INDEX) out[id] = structuredClone(f.default);
  return out;
})();

/* fields worth shuffling when the dice button is pressed */
export const RANDOMIZABLE = [
  'aspect', 'padding', 'bgMode', 'bg1', 'bg2', 'bgAngle', 'bgSoft',
  'arrange', 'count', 'cols', 'gap', 'jitter', 'ringR', 'ringSpin', 'scale',
  'shape', 'size', 'sizeVar', 'rotate', 'rotateVar', 'corner',
  'fillMode', 'fill1', 'fill2', 'opacity', 'blend',
  'blur', 'glowOn', 'glow', 'glowColor', 'grain', 'vignette', 'seed',
];
