import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { EventBus } from "../events/eventBus";
import type { GitManager } from "./gitManager";
import { safePath } from "./fileManager";
import type { Job, PreviewInstance, Runtime, ServiceInstance, Session } from "../shared/types";

type ManagedProcess = {
  process: ChildProcessWithoutNullStreams;
  command: string[];
  cwd: string;
};

const defaultJobTimeoutMs = 10 * 60 * 1000;

export class CommandManager {
  private jobs = new Map<string, Job>();
  private previews = new Map<string, PreviewInstance>();
  private services = new Map<string, ServiceInstance>();
  private processes = new Map<string, ManagedProcess>();
  private usedPorts = new Set<number>();

  constructor(
    private events: EventBus,
    private git: GitManager,
    private previewPortStart = Number(process.env.CODEX_WEB_PREVIEW_PORT_START || 17330),
    private previewPortEnd = Number(process.env.CODEX_WEB_PREVIEW_PORT_END || 17399),
  ) {}

  listJobs(sessionId: string) {
    return [...this.jobs.values()].filter((job) => job.sessionId === sessionId);
  }

  getJob(sessionId: string, id: string) {
    const job = this.jobs.get(id);
    if (!job || job.sessionId !== sessionId) throw new Error("Job not found");
    return job;
  }

  async startJob(session: Session, command: string[], options: { cwd?: string; timeoutMs?: number } = {}) {
    const cwd = await resolveCommandCwd(session.cwd, options.cwd);
    const id = nanoid();
    const job: Job = {
      id,
      sessionId: session.id,
      cwd,
      command,
      status: "running",
      startedAt: Date.now(),
      stdout: [],
      stderr: [],
    };
    this.jobs.set(id, job);
    this.events.publish(session.id, { type: "job.started", job });

    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: process.env,
      shell: false,
    });
    this.processes.set(id, { process: child, command, cwd });

    const timeout = setTimeout(() => {
      if (job.status === "running") this.cancelJob(session.id, id);
    }, options.timeoutMs ?? defaultJobTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      job.stdout.push(text);
      this.events.publish(session.id, { type: "job.stdout", jobId: id, text });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      job.stderr.push(text);
      this.events.publish(session.id, { type: "job.stderr", jobId: id, text });
    });
    child.on("error", (error) => {
      job.stderr.push(`${error.message}\n`);
      job.status = "failed";
    });
    child.on("close", async (exitCode) => {
      clearTimeout(timeout);
      this.processes.delete(id);
      if (job.status !== "cancelled") {
        job.status = exitCode === 0 ? "succeeded" : "failed";
      }
      job.exitCode = exitCode ?? undefined;
      job.finishedAt = Date.now();
      this.events.publish(session.id, { type: "job.finished", jobId: id, exitCode: exitCode ?? -1 });
      this.events.publish(session.id, { type: "git.state.updated", state: await this.git.state(session.cwd) });
    });

    return job;
  }

  cancelJob(sessionId: string, id: string) {
    const job = this.getJob(sessionId, id);
    job.status = "cancelled";
    job.finishedAt = Date.now();
    this.processes.get(id)?.process.kill("SIGTERM");
    this.processes.delete(id);
    return job;
  }

  listPreviews(sessionId: string) {
    return [...this.previews.values()].filter((preview) => preview.sessionId === sessionId);
  }

  async startPreview(session: Session, command: string[], options: { cwd?: string } = {}) {
    const cwd = await resolveCommandCwd(session.cwd, options.cwd);
    const port = this.allocatePort();
    const id = nanoid();
    const preview: PreviewInstance = {
      id,
      sessionId: session.id,
      cwd,
      command,
      port,
      pid: 0,
      status: "starting",
      localUrl: `http://127.0.0.1:${port}/`,
      publicUrl: `/preview/${session.id}/${id}/`,
      startedAt: Date.now(),
    };
    this.previews.set(id, preview);

    const child = spawn(command[0], command.slice(1), {
      cwd,
      shell: false,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        VITE_HOST: "127.0.0.1",
        VITE_PORT: String(port),
      },
    });
    preview.pid = child.pid ?? 0;
    preview.status = "running";
    this.processes.set(id, { process: child, command, cwd });
    this.events.publish(session.id, { type: "preview.started", preview });

    child.stderr.on("data", (chunk: Buffer) => {
      this.events.publish(session.id, { type: "job.stderr", jobId: id, text: chunk.toString() });
    });
    child.stdout.on("data", (chunk: Buffer) => {
      this.events.publish(session.id, { type: "job.stdout", jobId: id, text: chunk.toString() });
    });
    child.on("close", () => {
      this.usedPorts.delete(port);
      this.processes.delete(id);
      const current = this.previews.get(id);
      if (current && current.status !== "stopped") current.status = "failed";
      this.events.publish(session.id, { type: "preview.stopped", previewId: id });
    });

    return preview;
  }

  stopPreview(sessionId: string, id: string) {
    const preview = this.previews.get(id);
    if (!preview || preview.sessionId !== sessionId) throw new Error("Preview not found");
    preview.status = "stopped";
    this.usedPorts.delete(preview.port);
    this.processes.get(id)?.process.kill("SIGTERM");
    this.processes.delete(id);
    this.events.publish(sessionId, { type: "preview.stopped", previewId: id });
    return preview;
  }

  async restartPreview(session: Session, id: string) {
    const preview = this.previews.get(id);
    if (!preview || preview.sessionId !== session.id) throw new Error("Preview not found");
    const command = preview.command;
    const cwd = preview.cwd;
    this.stopPreview(session.id, id);
    return this.startPreview(session, command, { cwd });
  }

  getPreviewTarget(sessionId: string, previewId: string) {
    const preview = this.previews.get(previewId);
    if (!preview || preview.sessionId !== sessionId || preview.status === "stopped") return null;
    return preview.localUrl;
  }

  listServices(sessionId: string) {
    return [...this.services.values()].filter((service) => service.sessionId === sessionId);
  }

  async startService(session: Session, command: string[], options: { cwd?: string } = {}) {
    const cwd = await resolveCommandCwd(session.cwd, options.cwd);
    const id = nanoid();
    const service: ServiceInstance = {
      id,
      sessionId: session.id,
      cwd,
      command,
      pid: 0,
      status: "starting",
      startedAt: Date.now(),
      restartCount: 0,
      stdout: [],
      stderr: [],
    };
    const child = spawn(command[0], command.slice(1), { cwd, env: process.env, shell: false });
    service.pid = child.pid ?? 0;
    service.status = "running";
    this.services.set(id, service);
    this.processes.set(id, { process: child, command, cwd });
    this.events.publish(session.id, { type: "service.started", service });

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      service.stdout.push(text);
      this.events.publish(session.id, { type: "service.stdout", serviceId: id, text });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      service.stderr.push(text);
      this.events.publish(session.id, { type: "service.stderr", serviceId: id, text });
    });
    child.on("close", () => {
      this.processes.delete(id);
      const current = this.services.get(id);
      if (current && current.status !== "stopped") current.status = "failed";
      this.events.publish(session.id, { type: "service.stopped", serviceId: id });
    });
    return service;
  }

  stopService(sessionId: string, id: string) {
    const service = this.services.get(id);
    if (!service || service.sessionId !== sessionId) throw new Error("Service not found");
    service.status = "stopped";
    this.processes.get(id)?.process.kill("SIGTERM");
    this.processes.delete(id);
    this.events.publish(sessionId, { type: "service.stopped", serviceId: id });
    return service;
  }

  async restartService(session: Session, id: string) {
    const service = this.services.get(id);
    if (!service || service.sessionId !== session.id) throw new Error("Service not found");
    const nextRestartCount = service.restartCount + 1;
    const command = service.command;
    const cwd = service.cwd;
    this.stopService(session.id, id);
    const next = await this.startService(session, command, { cwd });
    next.restartCount = nextRestartCount;
    return next;
  }

  private allocatePort() {
    for (let port = this.previewPortStart; port <= this.previewPortEnd; port += 1) {
      if (this.usedPorts.has(port)) continue;
      this.usedPorts.add(port);
      return port;
    }
    throw new Error("No preview ports available");
  }
}

export function detectRuntime(command: string[]): Runtime {
  const name = path.basename(command[0] || "");
  if (name === "bun") return "bun";
  if (name === "python" || name === "python3" || name === "uvicorn" || name === "streamlit") return "python";
  if (name === "go") return "go";
  if (name === "cargo" || name === "rustc") return "rust";
  return "shell";
}

async function resolveCommandCwd(sessionCwd: string, input?: string) {
  const cwd = input ? safePath(sessionCwd, path.isAbsolute(input) ? path.relative(sessionCwd, input) : input) : sessionCwd;
  await access(cwd);
  return cwd;
}
