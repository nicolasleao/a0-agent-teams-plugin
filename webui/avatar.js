/**
 * Avatar Generator using Pixeloids
 * Generates deterministic pixel-art avatars seeded by agent name.
 * Uses the minimal variant for clean, friendly designs.
 * 
 * NOTE: Pixeloids is loaded as a regular script (UMD) in main.html,
 * so we access it via window.Pixeloids
 */

/**
 * Generate an avatar SVG for the given name.
 * Uses Pixeloids minimal variant for pixel-art style avatars.
 * @param {string} name - The seed name (typically agent name)
 * @param {number} size - The desired avatar size in pixels (default: 128)
 * @returns {string} - SVG HTML string
 */
export function generateAvatar(name, size = 128) {
  if (!name) name = 'agent';
  
  // Pixeloids is loaded as a UMD script, accessing via window
  if (typeof window !== 'undefined' && window.Pixeloids) {
    return window.Pixeloids.createSvg(name, {
      variant: 'minimal',
      size: size,
      background: true,
      margin: 0
    });
  }
  
  // Fallback: return a simple colored circle if Pixeloids isn't loaded
  const colors = ['#6495ed', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  const hash = name.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
  const color = colors[Math.abs(hash) % colors.length];
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${color}"/></svg>`;
}

export default generateAvatar;
