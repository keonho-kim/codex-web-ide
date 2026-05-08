import { spawn } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../../events/eventBus";
import type { ServiceInstance, Session } from "../../shared/types";
import { resolveCommandCwd } from "./path";
import { ProcessRegistry } from "./processRegistry";

export class ServiceRunner {
  private services = new Map<string, ServiceInstance>();

  constructor(
    private events: EventBus,
    private processes: ProcessRegistry,
  ) {}

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

  stop(sessionId: string, id: string) {
    const service = this.services.get(id);
    if (!service || service.sessionId !== sessionId) throw new Error("Service not found");
    service.status = "stopped";
    this.processes.kill(id);
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
}
