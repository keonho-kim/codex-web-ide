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
    return { command: appendMissingFlags(command, [["--host", "127.0.0.1"], ["--port", String(port)]]), env };
  }
  if (name === "streamlit") {
    return {
      command: appendMissingFlags(command, [
        ["--server.address", "127.0.0.1"],
        ["--server.port", String(port)],
      ]),
      env,
    };
  }
  return { command, env };
}

function appendMissingFlags(command: string[], flags: Array<[string, string]>) {
  const next = [...command];
  for (const [flag, value] of flags) {
    if (!next.includes(flag)) next.push(flag, value);
  }
  return next;
}

function commandName(command: string[]) {
  return path.basename(command[0] || "");
}
