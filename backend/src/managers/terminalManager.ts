import os from "node:os";
import fs from "node:fs";
import { spawn as spawnPty, type IDisposable, type IPty } from "bun-pty";
import { nanoid } from "nanoid";
import type { Session, TerminalSession } from "@backend/shared/types";

export type TerminalClient = {
  send(message: string): void;
};

type TerminalEntry = {
  record: TerminalSession;
  terminal: IPty;
  dataSubscription: IDisposable;
  exitSubscription: IDisposable;
  clients: Map<string, TerminalClient>;
  scrollback: string[];
};

const MAX_SCROLLBACK_CHUNKS = 400;

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
    const terminal = spawnPty(shell, shellArgs(shell), {
      cwd: session.cwd,
      name: "xterm-256color",
      cols,
      rows,
      env: {
        ...processEnv(),
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });
    const createdEntry: TerminalEntry = {
      terminal,
      dataSubscription: { dispose() {} },
      exitSubscription: { dispose() {} },
      clients: new Map(),
      scrollback: [],
      record: {
        id,
        sessionId: session.id,
        cwd: session.cwd,
        shell,
        pid: terminal.pid,
        cols,
        rows,
        status: "running",
        createdAt: Date.now(),
      },
    };
    createdEntry.dataSubscription = terminal.onData((output) => {
      this.handleOutput(createdEntry, output);
    });
    createdEntry.exitSubscription = terminal.onExit(({ exitCode }) => {
      if (createdEntry.record.status === "exited") return;
      createdEntry.record = { ...createdEntry.record, status: "exited", exitCode: exitCode ?? undefined, exitedAt: Date.now() };
      this.broadcast(createdEntry, { type: "exit", exitCode });
    });
    this.terminals.set(id, createdEntry);
    return createdEntry.record;
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
    entry.terminal.write(data);
  }

  resize(sessionId: string, terminalId: string, cols: number, rows: number) {
    const entry = this.require(sessionId, terminalId);
    if (entry.record.status !== "running") return entry.record;
    const nextCols = clampDimension(cols, entry.record.cols, 20, 240);
    const nextRows = clampDimension(rows, entry.record.rows, 6, 80);
    entry.terminal.resize(nextCols, nextRows);
    entry.record = { ...entry.record, cols: nextCols, rows: nextRows };
    this.broadcast(entry, { type: "resize", cols: nextCols, rows: nextRows });
    return entry.record;
  }

  close(sessionId: string, terminalId: string) {
    const entry = this.require(sessionId, terminalId);
    entry.dataSubscription.dispose();
    entry.exitSubscription.dispose();
    entry.terminal.kill();
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
      entry.dataSubscription.dispose();
      entry.exitSubscription.dispose();
      entry.terminal.kill();
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

  private handleOutput(entry: TerminalEntry, data: string) {
    if (!data) return;
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

function clampDimension(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
