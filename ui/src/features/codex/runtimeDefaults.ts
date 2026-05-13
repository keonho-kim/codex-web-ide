import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CodexRuntimeDefaults } from "@/lib/types";
import type { UiState } from "@/store/uiStore";

const commandSettingDefaults = {
  model: "Codex SDK default",
  reasoningEffort: "medium",
  sandbox: "workspace-write",
  approvals: "on-request",
  theme: "light",
};

export function useCodexRuntimeDefaults() {
  return useQuery({
    queryKey: ["codex", "runtime-defaults"],
    queryFn: () => api<CodexRuntimeDefaults>("/api/codex/runtime-defaults"),
  });
}

export function applyCodexRuntimeDefaults(
  settings: UiState["codexCommandSettings"],
  defaults?: CodexRuntimeDefaults,
  overrides: UiState["codexCommandSettingOverrides"] = {},
): UiState["codexCommandSettings"] {
  if (!defaults) return settings;
  return {
    ...settings,
    model: overrides.model || settings.model !== commandSettingDefaults.model ? settings.model : defaults.model.label,
    reasoningEffort: overrides.reasoningEffort || settings.reasoningEffort !== commandSettingDefaults.reasoningEffort ? settings.reasoningEffort : defaults.model.reasoningEffort,
    sandbox: overrides.sandbox || settings.sandbox !== commandSettingDefaults.sandbox ? settings.sandbox : defaults.permissions.sandbox,
    approvals: overrides.approvals || settings.approvals !== commandSettingDefaults.approvals ? settings.approvals : defaults.permissions.approvals,
    theme: overrides.theme || settings.theme !== commandSettingDefaults.theme ? settings.theme : defaults.theme.name,
  };
}
