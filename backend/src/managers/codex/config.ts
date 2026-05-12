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
};

export function loadCodexCliConfig(): CodexCliConfig {
  const configPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");
  const raw = readConfig(configPath);
  if (!raw) return { configPath };

  const parsed = parseToml(raw);
  return {
    approvalPolicy: approvalMode(parsed.approval_policy),
    configPath,
    model: stringValue(parsed.model),
    modelReasoningEffort: reasoningEffort(parsed.model_reasoning_effort),
    sandboxMode: sandboxMode(parsed.sandbox_mode),
  };
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
