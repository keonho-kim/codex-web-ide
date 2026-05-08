import path from "node:path";

const destructiveGitSubcommands = new Set(["reset", "clean", "rebase"]);

export function assertCommandAllowed(command: string[], approvedDangerous = false) {
  if (!isDangerousCommand(command) || approvedDangerous) return;
  throw new Error("Command requires explicit approval because it may be destructive.");
}

export function isDangerousCommand(command: string[]) {
  const name = path.basename(command[0] || "");
  if (name === "git") return isDangerousGitCommand(command.slice(1));
  return command.some((part) => /^(-rf|-fr|--force)$/.test(part)) && command.some((part) => ["rm", "trash"].includes(path.basename(part)));
}

function isDangerousGitCommand(args: string[]) {
  const subcommand = args.find((arg) => !arg.startsWith("-"));
  if (!subcommand) return false;
  if (subcommand === "push") return args.some((arg) => arg === "--force" || arg === "-f" || arg.startsWith("--force-with-lease"));
  if (!destructiveGitSubcommands.has(subcommand)) return false;
  if (subcommand === "reset") return args.includes("--hard");
  return true;
}
