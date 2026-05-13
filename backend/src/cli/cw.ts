#!/usr/bin/env bun
export {};

type ManagedCommandKind = "job" | "preview" | "service";

const args = process.argv.slice(2);
const command = args[0] || "start";

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function main() {
  switch (command) {
    case "start": {
      const { start } = await import("@backend/cli/serverCommands");
      await start(args.slice(1));
      break;
    }
    case "doctor": {
      const { runDoctor } = await import("@backend/cli/doctor");
      await runDoctor();
      break;
    }
    case "open": {
      const { open } = await import("@backend/cli/serverCommands");
      await open();
      break;
    }
    case "job":
    case "preview":
    case "service": {
      const { runManagedCommand } = await import("@backend/cli/managedCommands");
      await runManagedCommand(command as ManagedCommandKind, args.slice(1));
      break;
    }
    case "status": {
      const { status } = await import("@backend/cli/serverCommands");
      await status();
      break;
    }
    case "stop": {
      const { stop } = await import("@backend/cli/serverCommands");
      await stop();
      break;
    }
    case "restart": {
      const { start, stop } = await import("@backend/cli/serverCommands");
      await stop();
      await start(args.slice(1));
      break;
    }
    case "init": {
      const { init } = await import("@backend/cli/serverCommands");
      await init(args.slice(1));
      break;
    }
    case "update": {
      const { update } = await import("@backend/cli/serverCommands");
      await update();
      break;
    }
    case "upgrade": {
      const { upgrade } = await import("@backend/cli/upgrade");
      await upgrade(args.slice(1));
      break;
    }
    case "uninstall": {
      const { uninstall } = await import("@backend/cli/uninstall");
      await uninstall(args.slice(1));
      break;
    }
    case "config": {
      const { configureTelegram } = await import("@backend/cli/telegramConfig");
      if (args[1] === "telegram") await configureTelegram();
      else printHelp();
      break;
    }
    default:
      printHelp();
      process.exit(command === "help" || command === "--help" || command === "-h" ? 0 : 1);
  }
}

function printHelp() {
  console.log(`Usage:
  cw start [--host 127.0.0.1] [--port 17321] [--preview-port-start 17330] [--preview-port-end 17399] [--auth enable|disable] (default: disable)
  cw stop
  cw restart [--host 127.0.0.1] [--port 17321] [--preview-port-start 17330] [--preview-port-end 17399] [--auth enable|disable] (default: disable)
  cw doctor
  cw status
  cw open
  cw init [project-path]
  cw update
  cw upgrade
  cw uninstall
  cw config telegram
  cw job [--approve-dangerous] <command...>
  cw preview [--approve-dangerous] <command...>
  cw service [--approve-dangerous] <command...>`);
}
