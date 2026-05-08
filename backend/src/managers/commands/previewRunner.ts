import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { PreviewInstance, Session } from "../../shared/types";
import { waitForPreviewHealth } from "./health";
import { resolveCommandCwd } from "./path";
import { PortAllocator } from "./portAllocator";
import { preparePreviewLaunch } from "./runtimeAdapter";
import { ProcessRegistry } from "./processRegistry";

export class PreviewRunner {
  private previews = new Map<string, PreviewInstance>();

  constructor(
    private events: EventBus,
    private ports: PortAllocator,
    private processes: ProcessRegistry,
  ) {}

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

    const launch = preparePreviewLaunch(command, port);
    const child = spawn(launch.command[0], launch.command.slice(1), {
      cwd,
      shell: false,
      env: launch.env,
    });
    preview.pid = child.pid ?? 0;
    this.processes.set(id, { process: child, command: launch.command, cwd });
    this.events.publish(session.id, { type: "preview.started", preview });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      preview.stderr.push(text);
      this.events.publish(session.id, { type: "preview.stderr", previewId: id, text });
    });
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      preview.stdout.push(text);
      this.events.publish(session.id, { type: "preview.stdout", previewId: id, text });
    });
    child.on("close", () => {
      this.ports.release(port);
      this.processes.delete(id);
      const current = this.previews.get(id);
      if (current && current.status !== "stopped") current.status = "failed";
      this.events.publish(session.id, { type: "preview.stopped", previewId: id });
    });

    void this.markRunningWhenHealthy(session.id, preview);
    return preview;
  }

  stop(sessionId: string, id: string) {
    const preview = this.previews.get(id);
    if (!preview || preview.sessionId !== sessionId) throw new Error("Preview not found");
    preview.status = "stopped";
    this.ports.release(preview.port);
    this.processes.kill(id);
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
    this.events.publish(sessionId, { type: "preview.health.updated", preview });
  }
}
