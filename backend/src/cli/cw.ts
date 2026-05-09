#!/usr/bin/env bun
import { runDoctor } from "./doctor";
import { runManagedCommand, type ManagedCommandKind } from "./managedCommands";
import { configureTelegram } from "./telegramConfig";
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
  case "config":
    if (args[1] === "telegram") await configureTelegram();
    else printHelp();
    break;
  default:
    printHelp();
    process.exit(command === "help" || command === "--help" || command === "-h" ? 0 : 1);
}

function printHelp() {
  console.log(`Usage:
  cw start [--host 127.0.0.1] [--port 17321] [--preview-port-start 17330] [--preview-port-end 17399] [--auth enable|disable]
  cw stop
  cw restart [--host 127.0.0.1] [--port 17321] [--preview-port-start 17330] [--preview-port-end 17399]
  cw doctor
  cw status
  cw open
  cw init [project-path]
  cw update
  cw config telegram
  cw job [--approve-dangerous] <command...>
  cw preview [--approve-dangerous] <command...>
  cw service [--approve-dangerous] <command...>`);
}
