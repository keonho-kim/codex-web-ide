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
    this.processes.get(id)?.process.kill("SIGTERM");
    this.processes.delete(id);
  }

  killAll() {
    for (const id of this.processes.keys()) this.kill(id);
  }

  delete(id: string) {
    this.processes.delete(id);
  }
}
