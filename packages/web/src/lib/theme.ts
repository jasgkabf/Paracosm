export const THEME_COLORS = {
  green: '#00ff88',
  cyan: '#00d4ff',
  dark: '#0a0a0f',
  gray: '#1a1a2e',
  surface: '#12121f',
  border: '#2a2a3e',
  text: '#e0e0e8',
  muted: '#6a6a8a',
} as const;

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getThemeColor(color: keyof typeof THEME_COLORS): string {
  return THEME_COLORS[color];
}
