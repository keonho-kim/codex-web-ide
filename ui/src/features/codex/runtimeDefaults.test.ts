import { expect, test } from "bun:test";
import { applyCodexRuntimeDefaults } from "@/features/codex/runtimeDefaults";
import type { UiState } from "@/store/uiStore";

const settings: UiState["codexCommandSettings"] = {
  approvals: "on-request",
  experimentalFeatures: {},
  model: "Codex SDK default",
  rawMode: false,
  reasoningEffort: "medium",
  sandbox: "workspace-write",
  statuslineItems: ["model-with-reasoning"],
  theme: "light",
  titleItems: ["project", "thread"],
  useThemeColors: true,
  vimMode: false,
};

const defaults = {
  model: { label: "gpt-test", source: "Codex CLI config", reasoningEffort: "high", reasoningSource: "Codex CLI config" },
  permissions: { sandbox: "danger-full-access", approvals: "never" },
  theme: { name: "dark" as const, source: "Codex CLI config" },
};

test("applies Codex runtime defaults until the user overrides a setting", () => {
  expect(applyCodexRuntimeDefaults(settings, defaults)).toMatchObject({
    approvals: "never",
    model: "gpt-test",
    reasoningEffort: "high",
    sandbox: "danger-full-access",
    theme: "dark",
  });

  expect(applyCodexRuntimeDefaults({ ...settings, theme: "light" }, defaults, { theme: true, reasoningEffort: true })).toMatchObject({
    reasoningEffort: "medium",
    theme: "light",
  });
});
