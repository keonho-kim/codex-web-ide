import path from "node:path";
import type { Runtime } from "../../shared/types";

export type LaunchSpec = {
  command: string[];
  env: NodeJS.ProcessEnv;
};

export function detectRuntime(command: string[]): Runtime {
  const name = commandName(command);
  if (name === "bun") return "bun";
  if (["python", "python3", "uvicorn", "streamlit"].includes(name)) return "python";
  if (name === "go") return "go";
  if (name === "cargo" || name === "rustc") return "rust";
  return "shell";
}

export function preparePreviewLaunch(command: string[], port: number): LaunchSpec {
  const name = commandName(command);
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    VITE_HOST: "127.0.0.1",
    VITE_PORT: String(port),
  };

  if (name === "uvicorn") {
    return { command: withManagedFlags(command, [["--host", "127.0.0.1"], ["--port", String(port)]]), env };
  }
  if (name === "streamlit") {
    return {
      command: withManagedFlags(command, [
        ["--server.address", "127.0.0.1"],
        ["--server.port", String(port)],
      ]),
      env,
    };
  }
  return { command, env };
}

function withManagedFlags(command: string[], flags: Array<[string, string]>) {
  const next = [...command];
  for (const [flag, value] of flags) {
    const index = next.indexOf(flag);
    if (index !== -1) {
      if (index === next.length - 1) next.push(value);
      else next[index + 1] = value;
      continue;
    }
    const inlineIndex = next.findIndex((part) => part.startsWith(`${flag}=`));
    if (inlineIndex !== -1) {
      next[inlineIndex] = `${flag}=${value}`;
      continue;
    }
    next.push(flag, value);
  }
  return next;
}

function commandName(command: string[]) {
  return path.basename(command[0] || "");
}
