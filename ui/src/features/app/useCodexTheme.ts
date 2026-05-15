import { useEffect, useMemo, useState } from "react";
import { applyCodexRuntimeDefaults, useCodexRuntimeDefaults } from "@/features/codex/runtimeDefaults";
import { useUiStore } from "@/store/uiStore";

export type CodexTheme = "light" | "dark" | "system" | "github" | "solarized";
export type ResolvedCodexTheme = Exclude<CodexTheme, "system">;

const codexThemes = new Set<CodexTheme>(["light", "dark", "system", "github", "solarized"]);

export function useCodexTheme() {
  const { resolvedTheme, theme } = useResolvedCodexTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.codexTheme = resolvedTheme;
    root.dataset.codexThemePreference = theme;
  }, [resolvedTheme, theme]);
}

export function useResolvedCodexTheme() {
  const settings = useUiStore((state) => state.codexCommandSettings);
  const overrides = useUiStore((state) => state.codexCommandSettingOverrides);
  const runtimeDefaults = useCodexRuntimeDefaults();
  const systemTheme = useSystemTheme();
  const theme = useMemo(() => {
    const value = applyCodexRuntimeDefaults(settings, runtimeDefaults.data, overrides).theme;
    return isCodexTheme(value) ? value : "light";
  }, [overrides, runtimeDefaults.data, settings]);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  return { resolvedTheme, theme };
}

function isCodexTheme(value: string): value is CodexTheme {
  return codexThemes.has(value as CodexTheme);
}

function useSystemTheme(): ResolvedCodexTheme {
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
