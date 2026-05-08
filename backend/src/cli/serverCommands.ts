import path from "node:path";
import { startServer } from "../server";
import { createPlatformAdapter } from "../platform/adapter";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";
import { api, serverBaseUrl } from "./apiClient";
import { readPidFile, removePidFile, writePidFile } from "./pidFile";

export async function start(input: string[]) {
  const host = readFlag(input, "--host") || undefined;
  const port = numberFlag(input, "--port");
  const server = await startServer({ host, port });
  await persistRuntimeSettings(server.host, server.port);
  await writePidFile(server.port);
  console.log(`Codex Web IDE listening on http://${server.host}:${server.port}`);
  if (server.auth?.enabled) {
    console.log(`Auth token: ${server.auth.token}`);
  }
  const removePid = () => void removePidFile();
  process.once("SIGINT", removePid);
  process.once("SIGTERM", removePid);
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

export async function init(input: string[]) {
  const cwd = path.resolve(input[0] || process.cwd());
  const store = new JsonStore();
  await store.ensure();
  const workspace = new WorkspaceManager(store);
  const project = await workspace.addProject({ cwd });
  await workspace.openProject(project.id);
  console.log(`Initialized project: ${project.name}`);
  console.log(project.cwd);
}

export async function update() {
  console.log("Use Bun to update the installed package:");
  console.log("  bun update -g @local/codex-web");
}

function readFlag(input: string[], name: string) {
  const index = input.indexOf(name);
  if (index === -1) return null;
  return input[index + 1] || null;
}

function numberFlag(input: string[], name: string) {
  const value = readFlag(input, name);
  return value ? Number(value) : undefined;
}

async function persistRuntimeSettings(host: string, port: number) {
  const store = new JsonStore();
  await store.ensure();
  const workspace = new WorkspaceManager(store);
  const settings = await workspace.getSettings();
  await workspace.updateSettings({ ...settings, host, port });
}
