import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepo = "keonho-kim/codex-web-ide";
const packageName = "codex-web-ide";

type UpgradeOptions = {
  currentModulePath?: string;
  env?: NodeJS.ProcessEnv;
};

export type UpgradePlan = {
  installDir: string;
  installRoot: string;
  scriptUrl: string;
  env: Record<string, string>;
};

export async function upgrade(input: string[] = []) {
  if (input.length > 0) throw new Error(`Unknown upgrade option: ${input[0]}`);
  const plan = buildUpgradePlan();
  console.log(`Upgrading ${packageName}`);
  console.log(`Install root: ${plan.installRoot}`);
  console.log(`Installer:    ${plan.scriptUrl}`);
  await runUpgradeInstaller(plan);
}

export function buildUpgradePlan(options: UpgradeOptions = {}): UpgradePlan {
  const env = options.env ?? process.env;
  const currentModulePath = options.currentModulePath ?? fileURLToPath(import.meta.url);
  const installDir = resolveInstallDir(currentModulePath);
  assertReleaseInstallDir(installDir);
  const installRoot = path.dirname(installDir);
  const repo = env.CW_INSTALL_REPO || defaultRepo;
  return {
    installDir,
    installRoot,
    scriptUrl: env.CW_INSTALL_SCRIPT_URL || `https://github.com/${repo}/releases/latest/download/install.sh`,
    env: {
      CW_INSTALL_REPO: repo,
      CW_INSTALL_ROOT: env.CW_INSTALL_ROOT || installRoot,
      CW_PRUNE_OLD_INSTALLS: env.CW_PRUNE_OLD_INSTALLS || "1",
      ...(env.CW_VERSION ? { CW_VERSION: env.CW_VERSION } : {}),
      ...(env.CW_TARBALL_URL ? { CW_TARBALL_URL: env.CW_TARBALL_URL } : {}),
    },
  };
}

function resolveInstallDir(currentModulePath: string) {
  return path.resolve(path.dirname(currentModulePath), "..", "..", "..");
}

function assertReleaseInstallDir(installDir: string) {
  const name = path.basename(installDir);
  if (/^v[^/]+-(linux|macos)-(arm64|x64)$/.test(name)) return;
  const defaultInstallRoot = path.join(os.homedir(), ".local", "share", packageName);
  throw new Error(`Refusing to upgrade from ${installDir}. Expected a release install such as ${path.join(defaultInstallRoot, "v0.1.0-linux-arm64")}.`);
}

function runUpgradeInstaller(plan: UpgradePlan) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("sh", ["-c", 'curl -fsSL "$1" | sh', "cw-upgrade", plan.scriptUrl], {
      env: { ...process.env, ...plan.env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(signal ? `Upgrade installer was terminated by ${signal}.` : `Upgrade installer exited with status ${code}.`));
    });
  });
}
