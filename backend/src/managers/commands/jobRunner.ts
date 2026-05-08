import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { Job, Session } from "../../shared/types";
import type { GitManager } from "../gitManager";
import type { CommandHistoryStore } from "./historyStore";
import { jobTimeoutMs } from "./jobTimeout";
import { pipeProcessOutput } from "./output";
import { resolveCommandCwd } from "./path";
import { ProcessRegistry } from "./processRegistry";

export class JobRunner {
  private jobs = new Map<string, Job>();

  constructor(
    private events: EventBus,
    private git: GitManager,
    private processes: ProcessRegistry,
    private history?: CommandHistoryStore,
  ) {}

  async hydrate() {
    const jobs = (await this.history?.loadJobs()) ?? [];
    for (const job of jobs) {
      this.jobs.set(job.id, job.status === "running" ? { ...job, status: "failed", finishedAt: job.finishedAt ?? Date.now() } : job);
    }
    await this.persist();
  }

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
    void this.persist();
    this.events.publish(session.id, { type: "job.started", job });

    const child = spawn(command[0], command.slice(1), { cwd, env: process.env, shell: false });
    this.processes.set(id, { process: child, command, cwd });

    const timeout = setTimeout(() => {
      if (job.status === "running") this.cancel(session.id, id);
    }, jobTimeoutMs(command, options.timeoutMs));

    pipeProcessOutput(child, job, {
      stdout: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "job.stdout", jobId: id, text });
      },
      stderr: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "job.stderr", jobId: id, text });
      },
    });
    child.on("error", (error) => {
      const text = `${error.message}\n`;
      job.stderr.push(text);
      job.status = "failed";
      void this.persist();
      this.events.publish(session.id, { type: "job.stderr", jobId: id, text });
    });
    child.on("close", async (exitCode) => {
      clearTimeout(timeout);
      this.processes.delete(id);
      const wasCancelled = job.status === "cancelled";
      if (!wasCancelled) {
        job.status = exitCode === 0 ? "succeeded" : "failed";
        job.exitCode = exitCode ?? undefined;
      } else {
        job.exitCode ??= -1;
      }
      job.finishedAt = Date.now();
      void this.persist();
      if (!wasCancelled) this.events.publish(session.id, { type: "job.finished", jobId: id, exitCode: exitCode ?? -1 });
      this.events.publish(session.id, { type: "git.state.updated", state: await this.git.state(session.cwd) });
    });

    return job;
  }

  cancel(sessionId: string, id: string) {
    const job = this.get(sessionId, id);
    if (job.status !== "running" && job.status !== "queued") return job;
    job.status = "cancelled";
    job.exitCode = -1;
    job.finishedAt = Date.now();
    this.processes.kill(id);
    void this.persist();
    this.events.publish(sessionId, { type: "job.finished", jobId: id, exitCode: -1 });
    return job;
  }

  async deleteSession(sessionId: string) {
    for (const job of this.list(sessionId)) {
      if (job.status === "running" || job.status === "queued") this.processes.kill(job.id);
      this.jobs.delete(job.id);
    }
    await this.persist();
  }

  private persist() {
    return this.history?.saveJobs([...this.jobs.values()]) ?? Promise.resolve();
  }
}
