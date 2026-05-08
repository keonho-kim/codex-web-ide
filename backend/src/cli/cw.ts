#!/usr/bin/env bun
import { runDoctor } from "./doctor";
import { runManagedCommand, type ManagedCommandKind } from "./managedCommands";
import { init, open, start, status, stop, update } from "./serverCommands";

const args = process.argv.slice(2);
const command = args[0] || "start";

switch (command) {
  case "start":
    await start(args.slice(1));
    break;
  case "doctor":
    await runDoctor();
    break;
  case "open":
    await open();
    break;
  case "job":
  case "preview":
  case "service":
    await runManagedCommand(command satisfies ManagedCommandKind, args.slice(1));
    break;
  case "status":
    await status();
    break;
  case "stop":
    await stop();
    break;
  case "restart":
    await stop();
    await start(args.slice(1));
    break;
  case "init":
    await init(args.slice(1));
    break;
  case "update":
    await update();
    break;
  default:
    printHelp();
    process.exit(command === "help" || command === "--help" || command === "-h" ? 0 : 1);
}

function printHelp() {
  console.log(`Usage:
  cw start [--host 127.0.0.1] [--port 17321]
  cw stop
  cw restart [--host 127.0.0.1] [--port 17321]
  cw doctor
  cw status
  cw open
  cw init [project-path]
  cw update
  cw job [--approve-dangerous] <command...>
  cw preview [--approve-dangerous] <command...>
  cw service [--approve-dangerous] <command...>`);
}
