import { startServer } from "../server";
import { createPlatformAdapter } from "../platform/adapter";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";
import { api, serverBaseUrl } from "./apiClient";
import { collectStartupDoctorWarnings } from "./doctor/checks";
import { readPidFile, removePidFile, writePidFile } from "./pidFile";
import { initProject } from "./projectInit";

export async function start(input: string[]) {
  const host = readFlag(input, "--host") || undefined;
  const port = numberFlag(input, "--port");
  const previewPortStart = numberFlag(input, "--preview-port-start");
  const previewPortEnd = numberFlag(input, "--preview-port-end");
  const auth = parseAuthFlag(input);
  if (previewPortStart && previewPortEnd && previewPortStart > previewPortEnd) {
    throw new Error("--preview-port-start must be less than or equal to --preview-port-end.");
  }
  const runningUrl = await runningServerUrl();
  if (runningUrl) {
    console.log(`Codex Web IDE already running on ${runningUrl}`);
    return;
  }
  await printStartupDoctorWarnings({ previewPortStart, previewPortEnd });
  const server = await startServer({ host, port, previewPortStart, previewPortEnd, auth });
  await persistRuntimeSettings(server.host, server.port, previewPortStart, previewPortEnd);
  await writePidFile(server.port, server.host);
  console.log(`Codex Web IDE listening on http://${server.host}:${server.port}`);
  if (server.auth?.enabled) {
    console.log("Auth: Telegram approval enabled");
  }
  const shutdown = createSignalShutdown(server.close);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => undefined);
}

export async function open() {
  await createPlatformAdapter().openUrl(await serverBaseUrl());
}

export async function status() {
  try {
    const baseUrl = await serverBaseUrl();
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    console.log(`running: ${body.ok ? "yes" : "unknown"}`);
    const pid = await readPidFile();
    if (pid) console.log(`pid: ${pid.pid}`);
    console.log(`url: ${baseUrl}`);
  } catch {
    console.log("running: no");
    process.exitCode = 1;
  }
}

export async function stop() {
  try {
    await api<{ ok: boolean }>("/api/shutdown", { method: "POST" });
    await removePidFile();
    console.log("stopped");
  } catch {
    console.log("running: no");
  }
}

async function runningServerUrl() {
  const baseUrl = await serverBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    return response.ok ? baseUrl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function init(input: string[]) {
  await initProject(input);
}

export async function update() {
  console.log("Use Bun to update the installed package:");
  console.log("  bun update -g @local/codex-web");
}

async function printStartupDoctorWarnings({
  previewPortEnd,
  previewPortStart,
}: {
  previewPortEnd?: number;
  previewPortStart?: number;
}) {
  const store = new JsonStore();
  await store.ensure();
  const settings = await new WorkspaceManager(store).getSettings();
  const warnings = await collectStartupDoctorWarnings({
    previewStart: previewPortStart ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_START || settings.previewPortStart),
    previewEnd: previewPortEnd ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_END || settings.previewPortEnd),
  });
  if (warnings.length === 0) return;
  console.log("Startup warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log("");
}

function readFlag(input: string[], name: string) {
  const index = input.indexOf(name);
  if (index === -1) return null;
  return input[index + 1] || null;
}

function numberFlag(input: string[], name: string) {
  const value = readFlag(input, name);
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error(`${name} must be a port between 1 and 65535.`);
  return number;
}

export function parseAuthFlag(input: string[]): "enable" | "disable" {
  const value = readFlag(input, "--auth");
  if (!value) return "disable";
  if (value === "enable" || value === "disable") return value;
  throw new Error("--auth must be either enable or disable.");
}

async function persistRuntimeSettings(host: string, port: number, previewPortStart?: number, previewPortEnd?: number) {
  const store = new JsonStore();
  await store.ensure();
  const workspace = new WorkspaceManager(store);
  const settings = await workspace.getSettings();
  await workspace.updateSettings({
    ...settings,
    host,
    port,
    previewPortStart: previewPortStart ?? settings.previewPortStart,
    previewPortEnd: previewPortEnd ?? settings.previewPortEnd,
  });
}

export type SignalShutdownOptions = {
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  error?: (message: string) => void;
  removePid?: () => Promise<void>;
};

const SHUTDOWN_TIMEOUT_MS = 2500;

export function createSignalShutdown(closeServer: () => Promise<void>, options: SignalShutdownOptions = {}) {
  let closing = false;
  const exit = options.exit ?? ((code) => process.exit(code));
  const log = options.log ?? ((message) => console.log(message));
  const errorLog = options.error ?? ((message) => console.error(message));
  const removePid = options.removePid ?? removePidFile;
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  let exitCode = 0;

  return () => {
    if (closing) {
      errorLog("Forced shutdown.");
      exit(130);
      return;
    }
    closing = true;
    log("Shutting down Codex Web IDE...");
    const timeout = setTimeout(() => {
      errorLog("Shutdown timed out; forcing exit.");
      exit(1);
    }, timeoutMs);
    timeout.unref?.();

    void closeServer()
      .catch((error) => {
        errorLog(error instanceof Error ? error.message : "Failed to close Codex Web IDE.");
        process.exitCode = 1;
        exitCode = 1;
      })
      .finally(() => {
        clearTimeout(timeout);
        void removePid().finally(() => exit(exitCode));
      });
  };
}
