import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { ServiceInstance, Session } from "../../shared/types";
import type { CommandHistoryStore } from "./historyStore";
import { pipeProcessOutput } from "./output";
import { resolveCommandCwd } from "./path";
import { ProcessRegistry } from "./processRegistry";

export class ServiceRunner {
  private services = new Map<string, ServiceInstance>();

  constructor(
    private events: EventBus,
    private processes: ProcessRegistry,
    private history?: CommandHistoryStore,
  ) {}

  async hydrate() {
    const services = (await this.history?.loadServices()) ?? [];
    for (const service of services) {
      this.services.set(service.id, ["running", "starting"].includes(service.status) ? { ...service, pid: 0, status: "stopped" } : service);
    }
    await this.persist();
  }

  list(sessionId: string) {
    return [...this.services.values()].filter((service) => service.sessionId === sessionId);
  }

  async start(session: Session, command: string[], options: { cwd?: string; restartCount?: number } = {}) {
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
      restartCount: options.restartCount ?? 0,
      stdout: [],
      stderr: [],
    };
    const child = spawn(command[0], command.slice(1), { cwd, env: process.env, shell: false });
    service.pid = child.pid ?? 0;
    service.status = "running";
    this.services.set(id, service);
    void this.persist();
    this.processes.set(id, { process: child, command, cwd });
    this.events.publish(session.id, { type: "service.started", service });

    pipeProcessOutput(child, service, {
      stdout: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "service.stdout", serviceId: id, text });
      },
      stderr: (text) => {
        void this.persist();
        this.events.publish(session.id, { type: "service.stderr", serviceId: id, text });
      },
    });
    child.on("close", () => {
      this.processes.delete(id);
      const current = this.services.get(id);
      if (current && current.status !== "stopped") current.status = "failed";
      void this.persist();
      this.events.publish(session.id, { type: "service.stopped", serviceId: id });
    });
    return service;
  }

  stop(sessionId: string, id: string) {
    const service = this.services.get(id);
    if (!service || service.sessionId !== sessionId) throw new Error("Service not found");
    service.status = "stopped";
    this.processes.kill(id);
    void this.persist();
    this.events.publish(sessionId, { type: "service.stopped", serviceId: id });
    return service;
  }

  async restart(session: Session, id: string) {
    const service = this.services.get(id);
    if (!service || service.sessionId !== session.id) throw new Error("Service not found");
    const restartCount = service.restartCount + 1;
    const { command, cwd } = service;
    this.stop(session.id, id);
    return this.start(session, command, { cwd, restartCount });
  }

  async deleteSession(sessionId: string) {
    for (const service of this.list(sessionId)) {
      if (service.status !== "stopped") {
        service.status = "stopped";
        this.processes.kill(service.id);
      }
      this.services.delete(service.id);
    }
    await this.persist();
  }

  private persist() {
    return this.history?.saveServices([...this.services.values()]) ?? Promise.resolve();
  }
}
