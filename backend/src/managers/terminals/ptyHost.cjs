const readline = require("node:readline");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const { spawn } = require("node-pty");

const options = JSON.parse(process.argv[2] || "{}");
const shell = resolveShell(options.shell);
const env = {
  ...process.env,
  ...(options.env || {}),
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
};
const terminal = createTerminal();

send({ type: "ready", pid: terminal.pid, backend: terminal.backend });

terminal.onData((data) => send({ type: "output", data }));
terminal.onExit(({ exitCode, signal }) => {
  send({ type: "exit", exitCode, signal });
  process.exit(0);
});

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (message.type === "input" && typeof message.data === "string") terminal.write(message.data);
    if (message.type === "resize" && Number.isFinite(message.cols) && Number.isFinite(message.rows)) terminal.resize(message.cols, message.rows);
    if (message.type === "kill") terminal.kill();
  } catch (error) {
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});

process.on("disconnect", () => terminal.kill());
process.on("SIGTERM", () => terminal.kill());
process.on("SIGINT", () => terminal.kill());

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function createTerminal() {
  try {
    const pty = spawn(shell, shellArgs(shell), {
      name: "xterm-256color",
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd,
      env,
    });
    return {
      backend: "pty",
      pid: pty.pid,
      write: (data) => pty.write(data),
      resize: (cols, rows) => pty.resize(cols, rows),
      kill: () => pty.kill(),
      onData: (handler) => pty.onData(handler),
      onExit: (handler) => pty.onExit(handler),
    };
  } catch (error) {
    const child = childProcess.spawn(shell, shellArgs(shell), {
      cwd: options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      backend: "pipe",
      pid: child.pid || 0,
      write: (data) => child.stdin.write(data.replace(/\r/g, "\n")),
      resize: () => undefined,
      kill: () => child.kill(),
      onData: (handler) => {
        child.stdout.on("data", (chunk) => handler(String(chunk)));
        child.stderr.on("data", (chunk) => handler(String(chunk)));
        child.on("error", (childError) => handler(`Terminal unavailable: ${childError.message}\n`));
      },
      onExit: (handler) => {
        child.on("exit", (exitCode, signal) => handler({ exitCode, signal }));
      },
    };
  }
}

function resolveShell(candidate) {
  const shells = [candidate, process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean);
  for (const shellPath of shells) {
    try {
      fs.accessSync(shellPath, fs.constants.X_OK);
      return shellPath;
    } catch {
      // Try the next known shell.
    }
  }
  return process.platform === "win32" ? process.env.COMSPEC || "cmd.exe" : "/bin/sh";
}

function shellArgs(shellPath) {
  if (process.platform === "win32") return [];
  const name = String(shellPath).split(/[\\/]/).pop();
  return name === "bash" || name === "zsh" || name === "sh" || name === "fish" ? ["-i"] : [];
}
