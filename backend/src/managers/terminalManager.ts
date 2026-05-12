import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import fs from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import type { Session, TerminalSession } from "@backend/shared/types";

export type TerminalClient = {
  send(message: string): void;
};

type TerminalEntry = {
  record: TerminalSession;
  process: ChildProcessWithoutNullStreams;
  clients: Map<string, TerminalClient>;
  scrollback: string[];
};

const MAX_SCROLLBACK_CHUNKS = 400;
const PTY_HOST = path.join(path.dirname(fileURLToPath(import.meta.url)), "terminals/ptyHost.cjs");

export class TerminalManager {
  private terminals = new Map<string, TerminalEntry>();

  list(sessionId: string) {
    return [...this.terminals.values()].filter((entry) => entry.record.sessionId === sessionId).map((entry) => entry.record);
  }

  create(session: Session, options: { cols?: number; rows?: number; shell?: string } = {}) {
    const id = nanoid();
    const cols = clampDimension(options.cols, 80, 20, 240);
    const rows = clampDimension(options.rows, 24, 6, 80);
    const shell = options.shell || defaultShell();
    const host = spawn(nodeBinary(), [
      PTY_HOST,
      JSON.stringify({
        shell,
        args: shellArgs(shell),
        cols,
        rows,
        cwd: session.cwd,
        env: {
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      }),
    ], {
      cwd: session.cwd,
      env: processEnv(),
    });
    const entry: TerminalEntry = {
      process: host,
      clients: new Map(),
      scrollback: [],
      record: {
        id,
        sessionId: session.id,
        cwd: session.cwd,
        shell,
        pid: host.pid ?? 0,
        cols,
        rows,
        status: "running",
        createdAt: Date.now(),
      },
    };
    const lines = readline.createInterface({ input: host.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => this.handleHostMessage(entry, line));
    host.stderr.on("data", (chunk) => this.handleOutput(entry, String(chunk)));
    host.on("exit", (exitCode) => {
      if (entry.record.status === "exited") return;
      entry.record = { ...entry.record, status: "exited", exitCode: exitCode ?? undefined, exitedAt: Date.now() };
      this.broadcast(entry, { type: "exit", exitCode });
    });
    this.terminals.set(id, entry);
    return entry.record;
  }

  attach(sessionId: string, terminalId: string, client: TerminalClient) {
    const entry = this.require(sessionId, terminalId);
    const clientId = nanoid();
    entry.clients.set(clientId, client);
    client.send(JSON.stringify({ type: "ready", terminal: entry.record }));
    for (const data of entry.scrollback) client.send(JSON.stringify({ type: "output", data }));
    return clientId;
  }

  detach(sessionId: string, terminalId: string, clientId?: string) {
    if (!clientId) return;
    const entry = this.terminals.get(terminalId);
    if (!entry || entry.record.sessionId !== sessionId) return;
    entry.clients.delete(clientId);
  }

  write(sessionId: string, terminalId: string, data: string) {
    const entry = this.require(sessionId, terminalId);
    if (entry.record.status !== "running") return;
    writeHost(entry, { type: "input", data });
  }

  resize(sessionId: string, terminalId: string, cols: number, rows: number) {
    const entry = this.require(sessionId, terminalId);
    if (entry.record.status !== "running") return entry.record;
    const nextCols = clampDimension(cols, entry.record.cols, 20, 240);
    const nextRows = clampDimension(rows, entry.record.rows, 6, 80);
    writeHost(entry, { type: "resize", cols: nextCols, rows: nextRows });
    entry.record = { ...entry.record, cols: nextCols, rows: nextRows };
    this.broadcast(entry, { type: "resize", cols: nextCols, rows: nextRows });
    return entry.record;
  }

  close(sessionId: string, terminalId: string) {
    const entry = this.require(sessionId, terminalId);
    writeHost(entry, { type: "kill" });
    entry.process.kill();
    entry.clients.clear();
    this.terminals.delete(terminalId);
  }

  deleteSession(sessionId: string) {
    for (const entry of [...this.terminals.values()]) {
      if (entry.record.sessionId === sessionId) this.close(sessionId, entry.record.id);
    }
  }

  shutdown() {
    for (const entry of [...this.terminals.values()]) {
      writeHost(entry, { type: "kill" });
      entry.process.kill();
    }
    this.terminals.clear();
  }

  private require(sessionId: string, terminalId: string) {
    const entry = this.terminals.get(terminalId);
    if (!entry || entry.record.sessionId !== sessionId) throw new Error("Terminal not found");
    return entry;
  }

  private broadcast(entry: TerminalEntry, payload: Record<string, unknown>) {
    const message = JSON.stringify(payload);
    for (const client of entry.clients.values()) client.send(message);
  }

  private handleHostMessage(entry: TerminalEntry, line: string) {
    const message = parseHostMessage(line);
    if (!message) return;
    if (message.type === "ready" && typeof message.pid === "number") {
      entry.record = { ...entry.record, pid: message.pid };
      return;
    }
    if (message.type === "output" && typeof message.data === "string") {
      this.handleOutput(entry, message.data);
      return;
    }
    if (message.type === "exit") {
      const exitCode = typeof message.exitCode === "number" ? message.exitCode : undefined;
      entry.record = { ...entry.record, status: "exited", exitCode, exitedAt: Date.now() };
      this.broadcast(entry, { type: "exit", exitCode });
    }
  }

  private handleOutput(entry: TerminalEntry, data: string) {
    entry.scrollback.push(data);
    if (entry.scrollback.length > MAX_SCROLLBACK_CHUNKS) entry.scrollback.splice(0, entry.scrollback.length - MAX_SCROLLBACK_CHUNKS);
    this.broadcast(entry, { type: "output", data });
  }
}

function defaultShell() {
  if (process.platform === "win32") return process.env.COMSPEC || "cmd.exe";
  const fallback = os.platform() === "darwin" ? "/bin/zsh" : "/bin/bash";
  return resolveShell(process.env.SHELL, fallback);
}

function shellArgs(shell: string) {
  if (process.platform === "win32") return [];
  const name = shell.split(/[\\/]/).pop();
  return name === "bash" || name === "zsh" || name === "sh" || name === "fish" ? ["-i"] : [];
}

function processEnv() {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function nodeBinary() {
  return process.env.CODEX_WEB_NODE || process.execPath || "node";
}

function resolveShell(candidate: string | undefined, fallback: string) {
  for (const shell of [candidate, fallback, "/bin/bash", "/bin/sh"].filter((value): value is string => Boolean(value))) {
    try {
      fs.accessSync(shell, fs.constants.X_OK);
      return shell;
    } catch {
      // Try the next shell candidate.
    }
  }
  return fallback;
}

function writeHost(entry: TerminalEntry, message: Record<string, unknown>) {
  if (!entry.process.stdin.writable) return;
  entry.process.stdin.write(`${JSON.stringify(message)}\n`);
}

function parseHostMessage(line: string) {
  try {
    return JSON.parse(line) as { type?: string; data?: unknown; pid?: unknown; exitCode?: unknown };
  } catch {
    return undefined;
  }
}

function clampDimension(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
