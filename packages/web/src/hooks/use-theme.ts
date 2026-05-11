"use client";

import { useState, useCallback, useEffect } from "react";

type Theme = "dark" | "light" | "system";

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  const getSystemTheme = useCallback((): "dark" | "light" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  const resolveTheme = useCallback(
    (t: Theme): "dark" | "light" => {
      if (t === "system") return getSystemTheme();
      return t;
    },
    [getSystemTheme]
  );

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);

      if (typeof window !== "undefined") {
        localStorage.setItem("paracosm-theme", newTheme);
        document.documentElement.classList.toggle("dark", resolved === "dark");
      }
    },
    [resolveTheme]
  );

  useEffect(() => {
    const stored = localStorage.getItem("paracosm-theme") as Theme | null;
    const initial = stored || "dark";
    setThemeState(initial);
    setResolvedTheme(resolveTheme(initial));

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        setResolvedTheme(getSystemTheme());
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, getSystemTheme, resolveTheme]);

  return { theme, resolvedTheme, setTheme };
}
