const destructiveGitSubcommands = new Set(["reset", "clean", "rebase"]);

export function requiresDangerousApproval(command: string[]) {
  const name = basename(command[0] || "");
  if (name === "git") return dangerousGit(command.slice(1));
  return command.some((part) => /^(-rf|-fr|--force)$/.test(part)) && command.some((part) => ["rm", "trash"].includes(basename(part)));
}

export function confirmDangerousCommand(command: string[]) {
  if (!requiresDangerousApproval(command)) return true;
  return window.confirm(`This command may be destructive:\n\n${command.join(" ")}\n\nRun it anyway?`);
}

function dangerousGit(args: string[]) {
  const subcommand = args.find((arg) => !arg.startsWith("-"));
  if (!subcommand) return false;
  if (subcommand === "push") return args.some((arg) => arg === "--force" || arg === "-f" || arg.startsWith("--force-with-lease"));
  if (!destructiveGitSubcommands.has(subcommand)) return false;
  if (subcommand === "reset") return args.includes("--hard");
  return true;
}

function basename(input: string) {
  return input.split(/[\\/]/).pop() || input;
}
