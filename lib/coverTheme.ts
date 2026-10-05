"use client";

import { useState, useEffect } from 'react';

export interface CoverTheme {
  primary: string;
  accent: string;
  lightAccent: string;
  glowRgba: string;
  ambientRgba: string;
  gradient: string;
}

const themeCache = new Map<string, CoverTheme>();

function toHex(n: number): string {
  const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function buildThemeFromRgb(r: number, g: number, b: number): CoverTheme {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / (2 * 255);

  let targetR = r;
  let targetG = g;
  let targetB = b;

  // If color is too dark, lift it so it glows nicely against the dark backdrop
  if (lum < 0.28) {
    const factor = 0.38 / Math.max(0.06, lum);
    targetR = Math.min(255, Math.round(r * factor));
    targetG = Math.min(255, Math.round(g * factor));
    targetB = Math.min(255, Math.round(b * factor));
  }

  // Accent: slightly brighter & vibrant
  const accentR = Math.min(255, Math.round(targetR * 1.15 + 15));
  const accentG = Math.min(255, Math.round(targetG * 1.15 + 12));
  const accentB = Math.min(255, Math.round(targetB * 1.15 + 18));

  // Light accent: readable pastel for text, subtitles & highlights
  const lightR = Math.min(255, Math.round(targetR + (255 - targetR) * 0.65));
  const lightG = Math.min(255, Math.round(targetG + (255 - targetG) * 0.65));
  const lightB = Math.min(255, Math.round(targetB + (255 - targetB) * 0.65));

  const primaryHex = rgbToHex(targetR, targetG, targetB);
  const accentHex = rgbToHex(accentR, accentG, accentB);
  const lightHex = rgbToHex(lightR, lightG, lightB);

  return {
    primary: primaryHex,
    accent: accentHex,
    lightAccent: lightHex,
    glowRgba: `rgba(${targetR}, ${targetG}, ${targetB}, 0.70)`,
    ambientRgba: `rgba(${targetR}, ${targetG}, ${targetB}, 0.38)`,
    gradient: `linear-gradient(135deg, ${primaryHex}, ${accentHex})`,
  };
}

export const DEFAULT_THEME: CoverTheme = {
  primary: '#e11d48',
  accent: '#f43f5e',
  lightAccent: '#fecdd3',
  glowRgba: 'rgba(225, 29, 72, 0.70)',
  ambientRgba: 'rgba(225, 29, 72, 0.38)',
  gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)',
};

export function extractThemeFromImage(imageUrl: string): Promise<CoverTheme> {
  if (!imageUrl || typeof window === 'undefined') {
    return Promise.resolve(DEFAULT_THEME);
  }

  if (themeCache.has(imageUrl)) {
    return Promise.resolve(themeCache.get(imageUrl)!);
  }

  return new Promise((resolve) => {
    const processImg = (src: string, isRetry = false) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(DEFAULT_THEME);
            return;
          }

          ctx.drawImage(img, 0, 0, 32, 32);
          const data = ctx.getImageData(0, 0, 32, 32).data;

          let bestColor = { r: 225, g: 29, b: 72 };
          let maxScore = -1;
          let sumR = 0, sumG = 0, sumB = 0, validPixels = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue;

            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const delta = maxC - minC;
            const lum = (maxC + minC) / (2 * 255);

            // Ignore extreme darks and extreme whites
            if (lum < 0.1 || lum > 0.92) continue;

            const sat = maxC === 0 ? 0 : delta / maxC;
            // Higher saturation and medium luminance score highest
            const score = sat * 3.2 + (lum > 0.25 && lum < 0.75 ? 1.5 : 0.4);

            if (score > maxScore) {
              maxScore = score;
              bestColor = { r, g, b };
            }

            sumR += r;
            sumG += g;
            sumB += b;
            validPixels++;
          }

          if (validPixels > 0 && maxScore < 0.6) {
            bestColor = {
              r: Math.round(sumR / validPixels),
              g: Math.round(sumG / validPixels),
              b: Math.round(sumB / validPixels),
            };
          }

          const theme = buildThemeFromRgb(bestColor.r, bestColor.g, bestColor.b);
          themeCache.set(imageUrl, theme);
          resolve(theme);
        } catch {
          if (!isRetry && !src.startsWith('/api/music/proxy')) {
            processImg(`/api/music/proxy?url=${encodeURIComponent(imageUrl)}`, true);
          } else {
            resolve(DEFAULT_THEME);
          }
        }
      };

      img.onerror = () => {
        if (!isRetry && !src.startsWith('/api/music/proxy')) {
          processImg(`/api/music/proxy?url=${encodeURIComponent(imageUrl)}`, true);
        } else {
          resolve(DEFAULT_THEME);
        }
      };
    };

    processImg(imageUrl);
  });
}

export function useCoverTheme(imageUrl: string | undefined): CoverTheme {
  const [theme, setTheme] = useState<CoverTheme>(() => {
    if (imageUrl && themeCache.has(imageUrl)) {
      return themeCache.get(imageUrl)!;
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    if (!imageUrl) {
      setTheme(DEFAULT_THEME);
      return;
    }

    let isMounted = true;
    extractThemeFromImage(imageUrl).then((extracted) => {
      if (isMounted) setTheme(extracted);
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return theme;
}
