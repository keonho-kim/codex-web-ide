import { createPlatformAdapter } from "@backend/platform/adapter";
import { JsonStore } from "@backend/managers/storage";
import { WorkspaceManager } from "@backend/managers/workspaceManager";
import { serverBaseUrl } from "@backend/cli/apiClient";
import { collectStartupDoctorWarnings } from "@backend/cli/doctor/checks";
import { readPidFile, removePidFile, writePidFile } from "@backend/cli/pidFile";
import { initProject } from "@backend/cli/projectInit";
import { createRuntimeSupervisor, type RuntimeSupervisorOptions } from "@backend/cli/runtimeSupervisor";
import { collectStartupAccessInfo, formatStartupAccessInfo } from "@backend/cli/startupAccess";
import { sendStartupAccessTelegram } from "@backend/cli/startupTelegram";

export { sendStartupAccessTelegram };

export async function start(input: string[]) {
  const host = readFlag(input, "--host") || undefined;
  const port = numberFlag(input, "--port");
  const previewPortStart = numberFlag(input, "--preview-port-start");
  const previewPortEnd = numberFlag(input, "--preview-port-end");
  const auth = parseAuthFlag(input);
  console.log("Starting Codex Web IDE");
  console.log(`${startupLabel("Config")} host=${host ?? "workspace default"} port=${port ?? "workspace default"} auth=${auth}`);
  if (previewPortStart && previewPortEnd && previewPortStart > previewPortEnd) {
    throw new Error("--preview-port-start must be less than or equal to --preview-port-end.");
  }
  console.log(`${startupLabel("Check")} Looking for an already running server`);
  const runningUrl = await runningServerUrl();
  if (runningUrl) {
    console.log(`Codex Web IDE already running on ${runningUrl}`);
    return;
  }
  console.log(`${startupLabel("Check")} Running startup diagnostics`);
  await printStartupDoctorWarnings({ previewPortStart, previewPortEnd });
  let shutdown: () => void = () => undefined;
  console.log(`${startupLabel("Server")} Starting local backend`);
  const { startServer } = await import("@backend/server");
  const server = await startServer({
    host,
    port,
    previewPortStart,
    previewPortEnd,
    auth,
    onShutdownRequest: () => shutdown(),
  });
  console.log(`${startupLabel("Store")} Saving runtime settings`);
  await persistRuntimeSettings(server.host, server.port, previewPortStart, previewPortEnd);
  console.log(`${startupLabel("Store")} Writing pid file`);
  await writePidFile(server.port, server.host);
  console.log(`${startupLabel("Access")} Resolving local and LAN URLs`);
  const access = await collectStartupAccessInfo(server.host, server.port);
  console.log("");
  console.log(formatStartupAccessInfo(access, Boolean(server.auth?.enabled)));
  if (server.auth?.enabled) await sendStartupAccessTelegram(access).catch((error) => console.warn(`Telegram startup notice failed: ${error instanceof Error ? error.message : String(error)}`));
  shutdown = createSignalShutdown(server.close);
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
    const response = await fetch(`${await serverBaseUrl()}/api/shutdown`, { method: "POST" });
    if (!response.ok) throw new Error(await response.text());
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
  console.log("Use the release installer to upgrade the installed package:");
  console.log("  cw upgrade");
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
    onProgress: (message) => console.log(`${startupLabel("Check")} ${message}`),
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

export type SignalShutdownOptions = RuntimeSupervisorOptions;
export const createSignalShutdown = createRuntimeSupervisor;

function startupLabel(name: string) {
  return `${name}:`.padEnd(9);
}
