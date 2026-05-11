export type Theme = "dark" | "light" | "system";

interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
}

const darkTheme: ThemeColors = {
  background: "#0a0a0f",
  foreground: "#e0e0e0",
  card: "#1a1a2e",
  cardForeground: "#e0e0e0",
  primary: "#00ff88",
  primaryForeground: "#0a0a0f",
  secondary: "#1a1a2e",
  secondaryForeground: "#e0e0e0",
  muted: "#2a2a3e",
  mutedForeground: "#888888",
  border: "#2a2a3e",
  accent: "#00d4ff",
  accentForeground: "#0a0a0f",
  destructive: "#ff3366",
  success: "#00ff88",
  warning: "#ffcc00",
  info: "#00d4ff",
};

const lightTheme: ThemeColors = {
  background: "#f5f5f5",
  foreground: "#1a1a2e",
  card: "#ffffff",
  cardForeground: "#1a1a2e",
  primary: "#00cc6a",
  primaryForeground: "#ffffff",
  secondary: "#e8e8e8",
  secondaryForeground: "#1a1a2e",
  muted: "#f0f0f0",
  mutedForeground: "#666666",
  border: "#d0d0d0",
  accent: "#0099cc",
  accentForeground: "#ffffff",
  destructive: "#cc0033",
  success: "#00cc6a",
  warning: "#cc9900",
  info: "#0099cc",
};

export function getThemeColors(theme: Theme): ThemeColors {
  if (theme === "light") return lightTheme;
  return darkTheme;
}

export function applyThemeToDocument(theme: Theme): void {
  const colors = getThemeColors(theme);
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });

  root.classList.toggle("dark", theme !== "light");
}

export function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") return getSystemTheme();
  return theme;
}
