#!/usr/bin/env bun
import path from "node:path";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import { execa } from "execa";
import { startServer } from "../server";
import { createPlatformAdapter } from "../platform/adapter";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";
import type { Job, PreviewInstance, ServiceInstance, Session } from "../shared/types";

const args = process.argv.slice(2);
const command = args[0] || "start";

switch (command) {
  case "start":
    await start(args.slice(1));
    break;
  case "doctor":
    await doctor();
    break;
  case "open":
    await open();
    break;
  case "job":
  case "preview":
  case "service":
    await runManagedCommand(command, args.slice(1));
    break;
  case "status":
    await status();
    break;
  case "stop":
    await stop();
    break;
  case "restart":
    await stop();
    await start(args.slice(1));
    break;
  case "init":
    await init(args.slice(1));
    break;
  case "update":
    await update();
    break;
  default:
    printHelp();
    process.exit(command === "help" || command === "--help" || command === "-h" ? 0 : 1);
}

async function start(input: string[]) {
  const host = readFlag(input, "--host") || "127.0.0.1";
  const port = Number(readFlag(input, "--port") || 17321);
  const server = await startServer({ host, port });
  await writePidFile(port);
  console.log(`Codex Web IDE listening on http://${server.host}:${server.port}`);
  const removePid = () => void fs.rm(pidFile(), { force: true });
  process.once("SIGINT", removePid);
  process.once("SIGTERM", removePid);
  await new Promise(() => undefined);
}

async function doctor() {
  const adapter = createPlatformAdapter();
  const appPort = Number(process.env.CODEX_WEB_PORT || 17321);
  const previewStart = Number(process.env.CODEX_WEB_PREVIEW_PORT_START || 17330);
  const previewEnd = Number(process.env.CODEX_WEB_PREVIEW_PORT_END || 17399);
  const checks = [
    ["Bun", (process.versions as Record<string, string | undefined>).bun || "unknown"],
    ["Codex", await binaryVersion("codex", ["--version"])],
    ["Git", await binaryVersion("git", ["--version"])],
    ["Python", await binaryVersion("python3", ["--version"])],
    ["Go", await binaryVersion("go", ["version"])],
    ["Rust", await binaryVersion("rustc", ["--version"])],
  ] as const;
  const appPortAvailable = await isPortAvailable(appPort);
  const previewPortsAvailable = await checkPreviewPorts(previewStart, previewEnd);

  console.log("codex-web doctor");
  console.log("");
  console.log(`Platform: ${adapter.platform}`);
  console.log(`Home:     ${adapter.getHomeDir()}`);
  for (const [name, result] of checks) {
    console.log(`${name.padEnd(8)} ${result || "missing"}`);
  }
  console.log(`Port:     ${appPort} ${appPortAvailable ? "available" : "in use"}`);
  console.log(`Preview:  ${previewStart}-${previewEnd} ${previewPortsAvailable ? "available" : "partially in use"}`);

  if (adapter.platform === "termux") {
    console.log("");
    console.log("Warnings:");
    console.log("- Termux battery optimization may stop long-running sessions.");
    console.log("- Run termux-wake-lock for long-running work.");
    console.log("- Run termux-setup-storage if projects live in shared storage.");
  }
}

async function open() {
  await createPlatformAdapter().openUrl("http://127.0.0.1:17321");
}

async function status() {
  try {
    const response = await fetch("http://127.0.0.1:17321/api/health");
    const body = await response.json();
    console.log(`running: ${body.ok ? "yes" : "unknown"}`);
    const pid = await readPidFile();
    if (pid) console.log(`pid: ${pid.pid}`);
  } catch {
    console.log("running: no");
    process.exitCode = 1;
  }
}

async function stop() {
  try {
    await api<{ ok: boolean }>("/api/shutdown", { method: "POST" });
    await fs.rm(pidFile(), { force: true });
    console.log("stopped");
  } catch {
    console.log("running: no");
  }
}

async function init(input: string[]) {
  const cwd = path.resolve(input[0] || process.cwd());
  const store = new JsonStore();
  await store.ensure();
  const workspace = new WorkspaceManager(store);
  const project = await workspace.addProject({ cwd });
  await workspace.openProject(project.id);
  console.log(`Initialized project: ${project.name}`);
  console.log(project.cwd);
}

async function update() {
  console.log("Use Bun to update the installed package:");
  console.log("  bun update -g @local/codex-web");
}

async function runManagedCommand(kind: "job" | "preview" | "service", commandArgs: string[]) {
  if (commandArgs.length === 0) {
    console.error(`Usage: cw ${kind} <command...>`);
    process.exit(1);
  }
  const session = await ensureSessionForCwd();
  const result = await api<Job | PreviewInstance | ServiceInstance>(`/api/sessions/${session.id}/commands/${kind}`, {
    method: "POST",
    body: { command: commandArgs, cwd: process.cwd() },
  });

  if (kind === "job") {
    const exitCode = await followJob(session.id, (result as Job).id);
    process.exit(exitCode);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function binaryVersion(name: string, versionArgs: string[]) {
  try {
    const { stdout } = await execa(name, versionArgs);
    return stdout.split("\n")[0];
  } catch {
    return null;
  }
}

async function checkPreviewPorts(start: number, end: number) {
  const sample = [start, Math.floor((start + end) / 2), end];
  const checks = await Promise.all(sample.map((port) => isPortAvailable(port)));
  return checks.every(Boolean);
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function readFlag(input: string[], name: string) {
  const index = input.indexOf(name);
  if (index === -1) return null;
  return input[index + 1] || null;
}

function printHelp() {
  console.log(`Usage:
  cw start [--host 127.0.0.1] [--port 17321]
  cw stop
  cw restart [--host 127.0.0.1] [--port 17321]
  cw doctor
  cw status
  cw open
  cw init [project-path]
  cw update
  cw job <command...>
  cw preview <command...>
  cw service <command...>`);
}

async function ensureSessionForCwd() {
  const cwd = path.resolve(process.cwd());
  const sessions = await api<Session[]>("/api/sessions");
  const existing = sessions.find((session) => session.cwd === cwd);
  if (existing) return existing;
  return api<Session>("/api/sessions", { method: "POST", body: { cwd } });
}

async function followJob(sessionId: string, jobId: string) {
  let stdoutOffset = 0;
  let stderrOffset = 0;
  for (;;) {
    const job = await api<Job>(`/api/sessions/${sessionId}/jobs/${jobId}`);
    const stdout = job.stdout.slice(stdoutOffset).join("");
    const stderr = job.stderr.slice(stderrOffset).join("");
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    stdoutOffset = job.stdout.length;
    stderrOffset = job.stderr.length;
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job.exitCode ?? (job.status === "succeeded" ? 0 : 1);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function api<T>(pathName: string, options: { method?: string; body?: unknown } = {}) {
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:17321${pathName}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Codex Web IDE is not running. Start it with `cw start` before using managed commands.");
  }
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

function pidFile() {
  return path.join(process.env.CODEX_WEB_HOME || path.join(os.homedir(), ".codex-web"), "codex-web.pid");
}

async function writePidFile(port: number) {
  await fs.mkdir(path.dirname(pidFile()), { recursive: true });
  await fs.writeFile(pidFile(), JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }, null, 2));
}

async function readPidFile() {
  try {
    return JSON.parse(await fs.readFile(pidFile(), "utf8")) as { pid: number; port: number; startedAt: number };
  } catch {
    return null;
  }
}
