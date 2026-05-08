import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type ManagedProcess = {
  process: ChildProcessWithoutNullStreams;
  command: string[];
  cwd: string;
};

export class ProcessRegistry {
  private processes = new Map<string, ManagedProcess>();

  set(id: string, process: ManagedProcess) {
    this.processes.set(id, process);
  }

  kill(id: string) {
    const process = this.processes.get(id);
    if (!process) return false;
    process.process.kill("SIGTERM");
    this.processes.delete(id);
    return true;
  }

  killAll() {
    for (const id of this.processes.keys()) this.kill(id);
  }

  isAlive(id: string) {
    const process = this.processes.get(id)?.process;
    return Boolean(process && process.exitCode === null && process.signalCode === null);
  }

  delete(id: string) {
    this.processes.delete(id);
  }
}
