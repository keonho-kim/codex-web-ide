import type { ChildProcessWithoutNullStreams } from "node:child_process";

export function pipeProcessOutput(
  child: ChildProcessWithoutNullStreams,
  target: { stdout: string[]; stderr: string[] },
  handlers: {
    stdout(text: string): void;
    stderr(text: string): void;
  },
) {
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    target.stdout.push(text);
    handlers.stdout(text);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    target.stderr.push(text);
    handlers.stderr(text);
  });
}
