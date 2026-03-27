/**
 * Procedural SVG Avatar Generator
 * Generates deterministic circle-face avatars seeded by agent name.
 * Inspired by bold, geometric, friendly designs with two-color fills.
 */

// --- Color Palette ---
const WARM_COLORS = [
  "#E74C3C", // red
  "#E67E22", // orange
  "#F39C12", // amber
  "#FF6B6B", // coral
  "#E91E63", // rose
];

const COOL_COLORS = [
  "#3498DB", // blue
  "#5C6BC0", // indigo
  "#009688", // teal
  "#9B59B6", // violet
  "#1A237E", // navy
];

// --- Hash Function (djb2) ---
function hashName(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// --- Background Presets ---
// Each returns an SVG defs+shapes string for the background within a circle clip.
// bg and accent are the two colors. cx,cy = center, r = radius.
const BACKGROUND_PRESETS = [
  // 0: Solid fill
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>`,

  // 1: Vertical half split
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>
    <clipPath id="vhalf"><circle cx="${s/2}" cy="${s/2}" r="${s/2}"/></clipPath>
    <rect x="${s/2}" y="0" width="${s/2}" height="${s}" fill="${accent}" clip-path="url(#vhalf)"/>`,

  // 2: Horizontal half split
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>
    <clipPath id="hhalf"><circle cx="${s/2}" cy="${s/2}" r="${s/2}"/></clipPath>
    <rect x="0" y="${s/2}" width="${s}" height="${s/2}" fill="${accent}" clip-path="url(#hhalf)"/>`,

  // 3: Diagonal split (top-left to bottom-right)
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>
    <clipPath id="diag"><circle cx="${s/2}" cy="${s/2}" r="${s/2}"/></clipPath>
    <polygon points="${s},0 ${s},${s} 0,${s}" fill="${accent}" clip-path="url(#diag)"/>`,

  // 4: Quarter circle (corner arc)
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>
    <clipPath id="qarc"><circle cx="${s/2}" cy="${s/2}" r="${s/2}"/></clipPath>
    <circle cx="0" cy="${s}" r="${s * 0.7}" fill="${accent}" clip-path="url(#qarc)"/>`,

  // 5: Concentric ring
  (bg, accent, s) => `
    <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${accent}"/>
    <circle cx="${s/2}" cy="${s/2}" r="${s * 0.35}" fill="${bg}"/>`,
];

// --- Face Presets ---
// Each returns SVG elements for eyes and mouth. s = size, face color is always white/light.
const FACE_COLOR = "#FFFFFF";
const FACE_PRESETS = [
  // 0: Dot eyes + smile curve
  (s) => {
    const ex = s * 0.35, ex2 = s * 0.65, ey = s * 0.4, er = s * 0.045;
    const mx = s * 0.35, my = s * 0.6, mx2 = s * 0.65;
    return `
      <circle cx="${ex}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${ex2}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <path d="M${mx},${my} Q${s/2},${s*0.72} ${mx2},${my}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>`;
  },

  // 1: Dot eyes + open-mouth circle
  (s) => {
    const ex = s * 0.35, ex2 = s * 0.65, ey = s * 0.4, er = s * 0.045;
    return `
      <circle cx="${ex}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${ex2}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${s/2}" cy="${s*0.62}" r="${s*0.06}" fill="${FACE_COLOR}"/>`;
  },

  // 2: Dot eyes + flat line mouth
  (s) => {
    const ex = s * 0.35, ex2 = s * 0.65, ey = s * 0.4, er = s * 0.045;
    return `
      <circle cx="${ex}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${ex2}" cy="${ey}" r="${er}" fill="${FACE_COLOR}"/>
      <line x1="${s*0.38}" y1="${s*0.62}" x2="${s*0.62}" y2="${s*0.62}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" stroke-linecap="round"/>`;
  },

  // 3: Dash eyes + smile
  (s) => {
    const ey = s * 0.4;
    return `
      <line x1="${s*0.28}" y1="${ey}" x2="${s*0.42}" y2="${ey}" stroke="${FACE_COLOR}" stroke-width="${s*0.03}" stroke-linecap="round"/>
      <line x1="${s*0.58}" y1="${ey}" x2="${s*0.72}" y2="${ey}" stroke="${FACE_COLOR}" stroke-width="${s*0.03}" stroke-linecap="round"/>
      <path d="M${s*0.35},${s*0.6} Q${s/2},${s*0.72} ${s*0.65},${s*0.6}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>`;
  },

  // 4: Wink (one dot, one arc) + smile
  (s) => {
    const er = s * 0.045;
    return `
      <circle cx="${s*0.35}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <path d="M${s*0.58},${s*0.4} Q${s*0.65},${s*0.35} ${s*0.72},${s*0.4}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>
      <path d="M${s*0.35},${s*0.6} Q${s/2},${s*0.72} ${s*0.65},${s*0.6}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>`;
  },

  // 5: Wide eyes + small smile
  (s) => {
    const er = s * 0.06;
    return `
      <circle cx="${s*0.35}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${s*0.65}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <path d="M${s*0.42},${s*0.62} Q${s/2},${s*0.67} ${s*0.58},${s*0.62}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>`;
  },

  // 6: Dot eyes + smirk (asymmetric curve)
  (s) => {
    const er = s * 0.045;
    return `
      <circle cx="${s*0.35}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${s*0.65}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <path d="M${s*0.38},${s*0.6} Q${s*0.55},${s*0.6} ${s*0.65},${s*0.56}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>`;
  },

  // 7: Dot eyes + tongue-out
  (s) => {
    const er = s * 0.045;
    return `
      <circle cx="${s*0.35}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <circle cx="${s*0.65}" cy="${s*0.4}" r="${er}" fill="${FACE_COLOR}"/>
      <path d="M${s*0.35},${s*0.58} Q${s/2},${s*0.7} ${s*0.65},${s*0.58}" stroke="${FACE_COLOR}" stroke-width="${s*0.025}" fill="none" stroke-linecap="round"/>
      <ellipse cx="${s/2}" cy="${s*0.68}" rx="${s*0.04}" ry="${s*0.035}" fill="${FACE_COLOR}" opacity="0.85"/>`;
  },
];

/**
 * Generate a deterministic SVG avatar string from an agent name.
 * @param {string} name - The agent name (seed).
 * @param {number} [size=80] - The width/height of the SVG.
 * @returns {string} Inline SVG markup.
 */
export function generateAvatar(name, size = 80) {
  const hash = hashName(name || "agent");
  const s = size;

  // Pick colors from different temperature groups for contrast
  const warmIdx = hash % WARM_COLORS.length;
  const coolIdx = (hash >>> 8) % COOL_COLORS.length;

  // Alternate which is background vs accent based on another bit
  const swap = (hash >>> 16) & 1;
  const bg = swap ? COOL_COLORS[coolIdx] : WARM_COLORS[warmIdx];
  const accent = swap ? WARM_COLORS[warmIdx] : COOL_COLORS[coolIdx];

  // Pick presets
  const bgPresetIdx = (hash >>> 4) % BACKGROUND_PRESETS.length;
  const facePresetIdx = (hash >>> 12) % FACE_PRESETS.length;

  // Use unique clipPath IDs to avoid collisions when multiple avatars on page (include size to prevent cross-size conflicts)
  const uid = `av-${hash.toString(36)}-${s}`;
  let bgSvg = BACKGROUND_PRESETS[bgPresetIdx](bg, accent, s);
  // Replace generic clip IDs with unique ones
  bgSvg = bgSvg.replace(/id="(\w+)"/g, `id="${uid}-$1"`);
  bgSvg = bgSvg.replace(/url\(#(\w+)\)/g, `url(#${uid}-$1)`);

  const faceSvg = FACE_PRESETS[facePresetIdx](s);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${bgSvg}
    ${faceSvg}
  </svg>`;
}
