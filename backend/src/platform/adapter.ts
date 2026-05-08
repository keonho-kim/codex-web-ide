import { execa } from "execa";
import os from "node:os";
import path from "node:path";

export type Platform = "termux" | "linux" | "macos" | "wsl";

export type PlatformAdapter = {
  platform: Platform;
  openUrl(url: string): Promise<void>;
  getDefaultProjectsDir(): string;
  getShell(): string;
  resolveBinary(name: string): Promise<string | null>;
  getHomeDir(): string;
};

function detectPlatform(): Platform {
  if (process.env.PREFIX?.includes("com.termux")) return "termux";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux" && os.release().toLowerCase().includes("microsoft")) return "wsl";
  return "linux";
}

export function createPlatformAdapter(): PlatformAdapter {
  const platform = detectPlatform();
  return {
    platform,
    async openUrl(url) {
      const candidates =
        platform === "termux"
          ? ["termux-open-url"]
          : platform === "macos"
            ? ["open"]
            : platform === "wsl"
              ? ["wslview", "cmd.exe"]
              : ["xdg-open"];

      for (const binary of candidates) {
        const found = await this.resolveBinary(binary);
        if (!found) continue;
        if (binary === "cmd.exe") {
          await execa(binary, ["/c", "start", "", url], { windowsVerbatimArguments: true });
        } else {
          await execa(binary, [url]);
        }
        return;
      }
      throw new Error(`No URL opener found for ${platform}`);
    },
    getDefaultProjectsDir() {
      return path.join(os.homedir(), "projects");
    },
    getShell() {
      return process.env.SHELL || "/bin/sh";
    },
    async resolveBinary(name) {
      try {
        const { stdout } = await execa("which", [name]);
        return stdout.trim() || null;
      } catch {
        return null;
      }
    },
    getHomeDir() {
      return os.homedir();
    },
  };
}
