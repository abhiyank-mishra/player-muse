/**
 * Color Extractor — Dynamically extracts dominant, vibrant theme colors from album artwork.
 * Powers dynamic ambient backgrounds, glows, waveforms, and player accents to match each song's cover.
 */

export interface ExtractedTheme {
  primary: string;       // Vibrant dominant color, e.g. "rgb(220, 38, 38)"
  secondary: string;     // Lighter accent for text & gradients, e.g. "rgb(252, 165, 165)"
  accent: string;        // Deep rich shade, e.g. "rgb(185, 28, 28)"
  highlight: string;     // Bright glowing tip color, e.g. "rgb(254, 202, 202)"
  glow: string;          // rgba glow for box-shadows & auras
  ambient: string;       // Soft rgba ambient background tint
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_THEME: ExtractedTheme = {
  primary: 'rgb(225, 29, 72)',
  secondary: 'rgb(251, 113, 133)',
  accent: 'rgb(190, 18, 60)',
  highlight: 'rgb(254, 205, 211)',
  glow: 'rgba(225, 29, 72, 0.55)',
  ambient: 'rgba(225, 29, 72, 0.40)',
  r: 225,
  g: 29,
  b: 72,
};

const themeCache = new Map<string, ExtractedTheme>();

/**
 * Calculates luminance (0 to 255)
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Calculates saturation (0 to 1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Creates full theme palette from RGB values
 */
export function buildThemeFromRgb(r: number, g: number, b: number): ExtractedTheme {
  // Ensure the color is punchy and not overly dim
  const lum = getLuminance(r, g, b);
  let adjR = r;
  let adjG = g;
  let adjB = b;

  if (lum < 50) {
    // Too dark — boost slightly
    const boost = 50 - lum;
    adjR = Math.min(255, Math.round(r + boost * 1.2));
    adjG = Math.min(255, Math.round(g + boost * 1.2));
    adjB = Math.min(255, Math.round(b + boost * 1.2));
  }

  const primary = `rgb(${adjR}, ${adjG}, ${adjB})`;
  
  // Secondary: Lighter & softer for text and gradient stops
  const secR = Math.min(255, Math.round(adjR + (255 - adjR) * 0.45));
  const secG = Math.min(255, Math.round(adjG + (255 - adjG) * 0.45));
  const secB = Math.min(255, Math.round(adjB + (255 - adjB) * 0.45));
  const secondary = `rgb(${secR}, ${secG}, ${secB})`;

  // Accent: Deeper shade for bases
  const accR = Math.max(0, Math.round(adjR * 0.75));
  const accG = Math.max(0, Math.round(adjG * 0.75));
  const accB = Math.max(0, Math.round(adjB * 0.75));
  const accent = `rgb(${accR}, ${accG}, ${accB})`;

  // Highlight: Very bright tip
  const hiR = Math.min(255, Math.round(adjR + (255 - adjR) * 0.75));
  const hiG = Math.min(255, Math.round(adjG + (255 - adjG) * 0.75));
  const hiB = Math.min(255, Math.round(adjB + (255 - adjB) * 0.75));
  const highlight = `rgb(${hiR}, ${hiG}, ${hiB})`;

  const glow = `rgba(${adjR}, ${adjG}, ${adjB}, 0.55)`;
  const ambient = `rgba(${adjR}, ${adjG}, ${adjB}, 0.40)`;

  return {
    primary,
    secondary,
    accent,
    highlight,
    glow,
    ambient,
    r: adjR,
    g: adjG,
    b: adjB
  };
}

/**
 * Extracts dominant vibrant color from an image URL via HTML Canvas.
 */
export async function extractThemeFromImage(imageUrl?: string | null): Promise<ExtractedTheme> {
  if (!imageUrl || typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  if (themeCache.has(imageUrl)) {
    return themeCache.get(imageUrl)!;
  }

  const tryLoadAndExtract = (src: string): Promise<ExtractedTheme> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(DEFAULT_THEME);

          // Downscale to 32x32 for high performance
          canvas.width = 32;
          canvas.height = 32;
          ctx.drawImage(img, 0, 0, 32, 32);

          const imgData = ctx.getImageData(0, 0, 32, 32).data;
          let bestR = 225, bestG = 29, bestB = 72;
          let highestScore = -1;

          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 128) continue; // Skip transparent

            const lum = getLuminance(r, g, b);
            const sat = getSaturation(r, g, b);

            // Skip pure blacks, pure whites, and washed-out greys
            if (lum < 25 || lum > 240) continue;
            if (sat < 0.15) continue;

            // Score favoring vibrant, rich colors
            // High saturation + balanced brightness
            const lumDistFromCenter = Math.abs(lum - 128) / 128;
            const score = sat * 2.0 + (1 - lumDistFromCenter) * 1.2;

            if (score > highestScore) {
              highestScore = score;
              bestR = r;
              bestG = g;
              bestB = b;
            }
          }

          const theme = buildThemeFromRgb(bestR, bestG, bestB);
          themeCache.set(imageUrl, theme);
          resolve(theme);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    return await tryLoadAndExtract(imageUrl);
  } catch {
    return DEFAULT_THEME;
  }
}
