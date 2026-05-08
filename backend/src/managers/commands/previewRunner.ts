import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { PreviewInstance, Session } from "../../shared/types";
import { waitForPreviewHealth } from "./health";
import type { CommandHistoryStore } from "./historyStore";
import { pipeProcessOutput } from "./output";
import { resolveCommandCwd } from "./path";
import { PortAllocator } from "./portAllocator";
import { preparePreviewLaunch } from "./runtimeAdapter";
import { restoreDetachedProcess } from "./processHydration";
import { ProcessRegistry } from "./processRegistry";

export class PreviewRunner {
  private previews = new Map<string, PreviewInstance>();

  constructor(
    private events: EventBus,
    private ports: PortAllocator,
    private processes: ProcessRegistry,
    private history?: CommandHistoryStore,
  ) {}

  async hydrate() {
    const previews = (await this.history?.loadPreviews()) ?? [];
    for (const preview of previews) {
      this.previews.set(preview.id, restoreDetachedProcess(preview));
    }
    await this.persist();
  }

  list(sessionId: string) {
    return [...this.previews.values()].filter((preview) => preview.sessionId === sessionId);
  }

  async start(session: Session, command: string[], options: { cwd?: string } = {}) {
    const cwd = await resolveCommandCwd(session.cwd, options.cwd);
    const port = this.ports.allocate();
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
      stdout: [],
      stderr: [],
    };
    this.previews.set(id, preview);
    void this.persist();

    const launch = preparePreviewLaunch(command, port);
    const child = spawn(launch.command[0], launch.command.slice(1), {
      cwd,
      shell: false,
      env: launch.env,
    });
    preview.pid = child.pid ?? 0;
    this.processes.set(id, { process: child, command: launch.command, cwd });
    this.events.publish(session.id, { type: "preview.started", preview });

    pipeProcessOutput(child, preview, {
      stdout: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "preview.stdout", previewId: id, text });
      },
      stderr: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "preview.stderr", previewId: id, text });
      },
    });
    child.on("error", (error) => {
      const text = `${error.message}\n`;
      preview.stderr.push(text);
      if (preview.status !== "stopped") preview.status = "failed";
      void this.persist();
      this.events.publish(session.id, { type: "preview.stderr", previewId: id, text });
    });
    child.on("close", () => {
      this.ports.release(port);
      this.processes.delete(id);
      const current = this.previews.get(id);
      if (current && current.status !== "stopped" && current.status !== "failed") current.status = "failed";
      void this.persist();
      this.events.publish(session.id, { type: "preview.stopped", previewId: id });
    });

    void this.markRunningWhenHealthy(session.id, preview);
    return preview;
  }

  stop(sessionId: string, id: string) {
    const preview = this.previews.get(id);
    if (!preview || preview.sessionId !== sessionId) throw new Error("Preview not found");
    preview.status = "stopped";
    if (!this.processes.kill(id)) this.ports.release(preview.port);
    void this.persist();
    this.events.publish(sessionId, { type: "preview.stopped", previewId: id });
    return preview;
  }

  async restart(session: Session, id: string) {
    const preview = this.previews.get(id);
    if (!preview || preview.sessionId !== session.id) throw new Error("Preview not found");
    const { command, cwd } = preview;
    this.stop(session.id, id);
    return this.start(session, command, { cwd });
  }

  async deleteSession(sessionId: string) {
    for (const preview of this.list(sessionId)) {
      if (preview.status !== "stopped") {
        preview.status = "stopped";
        if (!this.processes.kill(preview.id)) this.ports.release(preview.port);
      }
      this.previews.delete(preview.id);
    }
    await this.persist();
  }

  getTarget(sessionId: string, previewId: string) {
    const preview = this.previews.get(previewId);
    if (!preview || preview.sessionId !== sessionId || preview.status === "stopped") return null;
    return preview.localUrl;
  }

  private async markRunningWhenHealthy(sessionId: string, preview: PreviewInstance) {
    const healthy = await waitForPreviewHealth(preview.localUrl);
    preview.lastHealthCheckAt = Date.now();
    if (preview.status !== "starting") return;
    preview.status = healthy ? "running" : "failed";
    void this.persist();
    this.events.publish(sessionId, { type: "preview.health.updated", preview });
  }

  private persist() {
    return this.history?.savePreviews([...this.previews.values()]) ?? Promise.resolve();
  }
}
