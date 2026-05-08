import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { Job, Session } from "../../shared/types";
import type { GitManager } from "../gitManager";
import { resolveCommandCwd } from "./path";
import { ProcessRegistry } from "./processRegistry";

const defaultJobTimeoutMs = 10 * 60 * 1000;

export class JobRunner {
  private jobs = new Map<string, Job>();

  constructor(
    private events: EventBus,
    private git: GitManager,
    private processes: ProcessRegistry,
  ) {}

  list(sessionId: string) {
    return [...this.jobs.values()].filter((job) => job.sessionId === sessionId);
  }

  get(sessionId: string, id: string) {
    const job = this.jobs.get(id);
    if (!job || job.sessionId !== sessionId) throw new Error("Job not found");
    return job;
  }

  async start(session: Session, command: string[], options: { cwd?: string; timeoutMs?: number } = {}) {
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

    const child = spawn(command[0], command.slice(1), { cwd, env: process.env, shell: false });
    this.processes.set(id, { process: child, command, cwd });

    const timeout = setTimeout(() => {
      if (job.status === "running") this.cancel(session.id, id);
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
      if (job.status !== "cancelled") job.status = exitCode === 0 ? "succeeded" : "failed";
      job.exitCode = exitCode ?? undefined;
      job.finishedAt = Date.now();
      this.events.publish(session.id, { type: "job.finished", jobId: id, exitCode: exitCode ?? -1 });
      this.events.publish(session.id, { type: "git.state.updated", state: await this.git.state(session.cwd) });
    });

    return job;
  }

  cancel(sessionId: string, id: string) {
    const job = this.get(sessionId, id);
    job.status = "cancelled";
    job.finishedAt = Date.now();
    this.processes.kill(id);
    return job;
  }
}
