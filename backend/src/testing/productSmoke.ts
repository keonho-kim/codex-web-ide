import fs from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { JobRunner } from "../managers/commands/jobRunner";
import type { Session } from "../shared/types";

const tempRoots: string[] = [];

export async function cleanupTempRoots() {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
}

export async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-web-test-"));
  tempRoots.push(dir);
  return dir;
}

export function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No port assigned"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

export function listenOn(server: net.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

export function closeServer(server: net.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function webSocketRoundTrip(url: string, message: string) {
  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("WebSocket timeout")), 3000);
    ws.addEventListener("open", () => ws.send(message));
    ws.addEventListener("message", (event) => {
      clearTimeout(timer);
      ws.close();
      resolve(String(event.data));
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket error"));
    });
  });
}

export function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

export function testSession(cwd: string): Session {
  return {
    id: "session",
    cwd,
    name: "Session",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    status: "idle",
  };
}

export async function waitForJob(read: () => ReturnType<JobRunner["get"]>) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const job = read();
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job;
    if (Date.now() > deadline) throw new Error("Job did not finish");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export async function waitForService<T extends { status: string } | undefined>(read: () => T) {
  const deadline = Date.now() + 3000;
  for (;;) {
    const service = read();
    if (service && service.status !== "starting") return service;
    if (Date.now() > deadline) throw new Error("Service health check did not finish");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export async function waitForPreview<T extends { status: string } | undefined>(read: () => T) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const preview = read();
    if (preview && preview.status !== "starting") return preview;
    if (Date.now() > deadline) throw new Error("Preview health check did not finish");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function* codexEventStream(events: unknown[]) {
  for (const event of events) yield event as never;
}

export function startCli(args: string[], env: NodeJS.ProcessEnv) {
  return spawn(process.execPath, [path.resolve("bin/cw.ts"), ...args], {
    cwd: path.resolve("."),
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}

export function runCli(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = startCli(args, env);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 5000);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

export async function waitForHealth(url: string) {
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the CLI-started server is ready or the deadline expires.
    }
    if (Date.now() > deadline) throw new Error(`Server did not become healthy: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function waitForExit(child: ChildProcessWithoutNullStreams) {
  return new Promise<number | null>((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }
    child.once("close", resolve);
  });
}
