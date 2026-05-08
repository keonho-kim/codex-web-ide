const defaultJobTimeoutMs = 10 * 60 * 1000;
const installJobTimeoutMs = 30 * 60 * 1000;

export function jobTimeoutMs(command: string[], override?: number) {
  if (override) return override;
  return isInstallCommand(command) ? installJobTimeoutMs : defaultJobTimeoutMs;
}

export function isInstallCommand(command: string[]) {
  const [binary, subcommand, script] = command;
  if (!binary) return false;
  if (["bun", "npm", "pnpm", "yarn"].includes(binary) && subcommand === "install") return true;
  if (binary === "bun" && subcommand === "add") return true;
  if (binary === "bun" && subcommand === "run" && script && /^(install|setup)$/.test(script)) return true;
  if (["pip", "pip3"].includes(binary) && subcommand === "install") return true;
  if (["python", "python3"].includes(binary) && subcommand === "-m" && command[2] === "pip" && command[3] === "install") return true;
  return false;
}
