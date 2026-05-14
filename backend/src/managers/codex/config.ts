import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ApprovalMode, ModelReasoningEffort, SandboxMode, ThreadOptions } from "@openai/codex-sdk";

export type CodexCliConfig = {
  approvalPolicy?: ApprovalMode;
  configPath: string;
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  sandboxMode?: SandboxMode;
  theme?: CodexTheme;
};

export type CodexTheme = "light" | "dark" | "system" | "github" | "solarized";

type CachedCodexCliConfig = {
  config: CodexCliConfig;
  configPath: string;
  mtimeMs?: number;
  size?: number;
};

let cachedConfig: CachedCodexCliConfig | undefined;

export function loadCodexCliConfig(): CodexCliConfig {
  const configPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");
  const stat = configStat(configPath);
  if (cachedConfig?.configPath === configPath && cachedConfig.mtimeMs === stat?.mtimeMs && cachedConfig.size === stat?.size) return cachedConfig.config;
  const raw = readConfig(configPath);
  if (!raw) return rememberConfig({ configPath }, configPath, stat);

  const parsed = parseToml(raw);
  return rememberConfig({
    approvalPolicy: approvalMode(parsed.approval_policy),
    configPath,
    model: stringValue(parsed.model),
    modelReasoningEffort: reasoningEffort(parsed.model_reasoning_effort),
    sandboxMode: sandboxMode(parsed.sandbox_mode),
    theme: codexTheme(parsed.theme),
  }, configPath, stat);
}

export function codexThreadOptionsFromConfig(config = loadCodexCliConfig()): Pick<ThreadOptions, "approvalPolicy" | "model" | "modelReasoningEffort" | "sandboxMode"> {
  return {
    approvalPolicy: approvalMode(process.env.CODEX_APPROVAL_POLICY) ?? config.approvalPolicy,
    model: process.env.CODEX_MODEL || config.model,
    modelReasoningEffort: reasoningEffort(process.env.CODEX_MODEL_REASONING_EFFORT) ?? config.modelReasoningEffort,
    sandboxMode: sandboxMode(process.env.CODEX_SANDBOX_MODE) ?? config.sandboxMode,
  };
}

function readConfig(configPath: string) {
  try {
    return fs.readFileSync(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function configStat(configPath: string) {
  try {
    const stat = fs.statSync(configPath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function rememberConfig(config: CodexCliConfig, configPath: string, stat?: { mtimeMs: number; size: number }) {
  cachedConfig = { config, configPath, mtimeMs: stat?.mtimeMs, size: stat?.size };
  return config;
}

function parseToml(raw: string) {
  try {
    return Bun.TOML.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function approvalMode(value: unknown): ApprovalMode | undefined {
  return value === "never" || value === "on-request" || value === "on-failure" || value === "untrusted" ? value : undefined;
}

function reasoningEffort(value: unknown): ModelReasoningEffort | undefined {
  return value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh" ? value : undefined;
}

function sandboxMode(value: unknown): SandboxMode | undefined {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access" ? value : undefined;
}

function codexTheme(value: unknown): CodexTheme | undefined {
  return value === "light" || value === "dark" || value === "system" || value === "github" || value === "solarized" ? value : undefined;
}
