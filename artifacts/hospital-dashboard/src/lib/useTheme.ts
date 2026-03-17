import { useState, useEffect } from "react";

export type Theme = "light" | "dark";

function getStored(): Theme {
  try {
    const v = localStorage.getItem("theme");
    if (v === "dark" || v === "light") return v;
  } catch {}
  return "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStored);

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggle: () => setTheme(t => t === "dark" ? "light" : "dark"),
  };
}
