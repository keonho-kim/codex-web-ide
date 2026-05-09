const readline = require("node:readline");
const { spawn } = require("node-pty");

const options = JSON.parse(process.argv[2] || "{}");
const pty = spawn(options.shell, options.args || [], {
  name: "xterm-256color",
  cols: options.cols || 80,
  rows: options.rows || 24,
  cwd: options.cwd,
  env: {
    ...process.env,
    ...(options.env || {}),
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  },
});

send({ type: "ready", pid: pty.pid });

pty.onData((data) => send({ type: "output", data }));
pty.onExit(({ exitCode, signal }) => {
  send({ type: "exit", exitCode, signal });
  process.exit(0);
});

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (message.type === "input" && typeof message.data === "string") pty.write(message.data);
    if (message.type === "resize" && Number.isFinite(message.cols) && Number.isFinite(message.rows)) pty.resize(message.cols, message.rows);
    if (message.type === "kill") pty.kill();
  } catch (error) {
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});

process.on("disconnect", () => pty.kill());
process.on("SIGTERM", () => pty.kill());
process.on("SIGINT", () => pty.kill());

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
