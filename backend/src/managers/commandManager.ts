import type { EventBus } from "../events/eventBus";
import type { Session } from "../shared/types";
import type { GitManager } from "./gitManager";
import type { JsonStore } from "./storage";
import { CommandHistoryStore } from "./commands/historyStore";
import { JobRunner } from "./commands/jobRunner";
import { PortAllocator } from "./commands/portAllocator";
import { PreviewRunner } from "./commands/previewRunner";
import { ProcessRegistry } from "./commands/processRegistry";
import { assertCommandAllowed } from "./commands/safety";
import { ServiceRunner } from "./commands/serviceRunner";
export { detectRuntime } from "./commands/runtimeAdapter";

export class CommandManager {
  private processes = new ProcessRegistry();
  private jobs: JobRunner;
  private previews: PreviewRunner;
  private services: ServiceRunner;

  constructor(
    events: EventBus,
    git: GitManager,
    store?: JsonStore,
    previewPortStart = Number(process.env.CODEX_WEB_PREVIEW_PORT_START || 17330),
    previewPortEnd = Number(process.env.CODEX_WEB_PREVIEW_PORT_END || 17399),
  ) {
    const ports = new PortAllocator(previewPortStart, previewPortEnd);
    const history = store ? new CommandHistoryStore(store) : undefined;
    this.jobs = new JobRunner(events, git, this.processes, history);
    this.previews = new PreviewRunner(events, ports, this.processes, history);
    this.services = new ServiceRunner(events, this.processes, history);
  }

  async hydrate() {
    await Promise.all([this.jobs.hydrate(), this.previews.hydrate(), this.services.hydrate()]);
  }

  listJobs(sessionId: string) {
    return this.jobs.list(sessionId);
  }

  getJob(sessionId: string, id: string) {
    return this.jobs.get(sessionId, id);
  }

  startJob(session: Session, command: string[], options: { cwd?: string; timeoutMs?: number; approvedDangerous?: boolean } = {}) {
    assertCommandAllowed(command, options.approvedDangerous);
    return this.jobs.start(session, command, options);
  }

  cancelJob(sessionId: string, id: string) {
    return this.jobs.cancel(sessionId, id);
  }

  listPreviews(sessionId: string) {
    return this.previews.list(sessionId);
  }

  startPreview(session: Session, command: string[], options: { cwd?: string; approvedDangerous?: boolean } = {}) {
    assertCommandAllowed(command, options.approvedDangerous);
    return this.previews.start(session, command, options);
  }

  stopPreview(sessionId: string, id: string) {
    return this.previews.stop(sessionId, id);
  }

  restartPreview(session: Session, id: string) {
    return this.previews.restart(session, id);
  }

  getPreviewTarget(sessionId: string, previewId: string) {
    return this.previews.getTarget(sessionId, previewId);
  }

  listServices(sessionId: string) {
    return this.services.list(sessionId);
  }

  startService(session: Session, command: string[], options: { cwd?: string; approvedDangerous?: boolean } = {}) {
    assertCommandAllowed(command, options.approvedDangerous);
    return this.services.start(session, command, options);
  }

  stopService(sessionId: string, id: string) {
    return this.services.stop(sessionId, id);
  }

  restartService(session: Session, id: string) {
    return this.services.restart(session, id);
  }

  async deleteSession(sessionId: string) {
    await Promise.all([this.jobs.deleteSession(sessionId), this.previews.deleteSession(sessionId), this.services.deleteSession(sessionId)]);
  }

  shutdown() {
    this.processes.killAll();
  }
}
