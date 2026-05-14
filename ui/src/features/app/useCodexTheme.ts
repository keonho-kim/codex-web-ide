import { useEffect, useMemo, useState } from "react";
import { applyCodexRuntimeDefaults, useCodexRuntimeDefaults } from "@/features/codex/runtimeDefaults";
import { useUiStore } from "@/store/uiStore";

const codexThemes = new Set(["light", "dark", "system", "github", "solarized"]);

export function useCodexTheme() {
  const settings = useUiStore((state) => state.codexCommandSettings);
  const overrides = useUiStore((state) => state.codexCommandSettingOverrides);
  const runtimeDefaults = useCodexRuntimeDefaults();
  const systemTheme = useSystemTheme();
  const theme = useMemo(() => {
    const value = applyCodexRuntimeDefaults(settings, runtimeDefaults.data, overrides).theme;
    return codexThemes.has(value) ? value : "light";
  }, [overrides, runtimeDefaults.data, settings]);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.codexTheme = resolvedTheme;
    root.dataset.codexThemePreference = theme;
  }, [resolvedTheme, theme]);
}

function useSystemTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return theme;
}
