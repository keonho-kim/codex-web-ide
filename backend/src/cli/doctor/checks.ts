import fs from "node:fs/promises";
import net from "node:net";
import { execa } from "execa";
import { createPlatformAdapter } from "../../platform/adapter";

export type BinaryCheck = {
  name: string;
  command: string;
  versionArgs: string[];
  required: boolean;
};

export type BinaryResult = BinaryCheck & {
  version: string | null;
};

export type DoctorReport = {
  platform: string;
  home: string;
  binaries: BinaryResult[];
  appPort: number;
  appPortAvailable: boolean;
  previewStart: number;
  previewEnd: number;
  previewPorts: {
    sampled: string[];
    available: boolean;
  };
  warnings: string[];
};

export async function collectDoctorReport(options: { appPort?: number; previewStart?: number; previewEnd?: number } = {}): Promise<DoctorReport> {
  const adapter = createPlatformAdapter();
  const appPort = options.appPort ?? Number(process.env.CODEX_WEB_PORT || 17321);
  const previewStart = options.previewStart ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_START || 17330);
  const previewEnd = options.previewEnd ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_END || 17399);
  const binaries = await checkBinaries(defaultBinaryChecks());
  const appPortAvailable = await isPortAvailable(appPort);
  const previewPorts = await checkPreviewPorts(previewStart, previewEnd);
  const warnings = await buildWarnings(adapter.platform, binaries, appPort, appPortAvailable, previewPorts.available);

  return {
    platform: adapter.platform,
    home: adapter.getHomeDir(),
    binaries,
    appPort,
    appPortAvailable,
    previewStart,
    previewEnd,
    previewPorts,
    warnings,
  };
}

export async function collectStartupDoctorWarnings(options: { previewStart: number; previewEnd: number }) {
  const adapter = createPlatformAdapter();
  const binaries = await checkBinaries(defaultBinaryChecks().filter((check) => check.required));
  const previewPorts = await checkPreviewPorts(options.previewStart, options.previewEnd);
  const warnings = binaries.filter((binary) => binary.required && !binary.version).map((binary) => `${binary.name} is required for the core workflow.`);
  if (!previewPorts.available) warnings.push("One or more sampled preview ports are already in use.");
  if (adapter.platform === "termux") {
    warnings.push("Termux battery optimization may stop long-running sessions.");
    warnings.push("Run termux-wake-lock for long-running work.");
    if (!(await hasSharedStorageAccess())) warnings.push("Run termux-setup-storage if projects live in shared storage.");
  }
  return warnings;
}

function defaultBinaryChecks(): BinaryCheck[] {
  return [
    { name: "Bun", command: "bun", versionArgs: ["--version"], required: true },
    { name: "Codex", command: "codex", versionArgs: ["--version"], required: true },
    { name: "Git", command: "git", versionArgs: ["--version"], required: true },
    { name: "Python", command: "python3", versionArgs: ["--version"], required: false },
    { name: "uv", command: "uv", versionArgs: ["--version"], required: false },
    { name: "Go", command: "go", versionArgs: ["version"], required: false },
    { name: "Rust", command: "rustc", versionArgs: ["--version"], required: false },
    { name: "Cargo", command: "cargo", versionArgs: ["--version"], required: false },
  ];
}

async function checkBinaries(checks: BinaryCheck[]): Promise<BinaryResult[]> {
  return Promise.all(
    checks.map(async (check) => ({
      ...check,
      version: await binaryVersion(check.command, check.versionArgs),
    })),
  );
}

async function binaryVersion(name: string, versionArgs: string[]) {
  try {
    const { stdout, stderr } = await execa(name, versionArgs);
    return (stdout || stderr).split("\n")[0] || null;
  } catch {
    return null;
  }
}

async function checkPreviewPorts(start: number, end: number) {
  const sampled = [...new Set([start, Math.floor((start + end) / 2), end])].filter((port) => Number.isInteger(port) && port > 0);
  const checks = await Promise.all(sampled.map(async (port) => ({ port, available: await isPortAvailable(port) })));
  return {
    sampled: checks.map((check) => `${check.port}:${check.available ? "available" : "in-use"}`),
    available: checks.length > 0 && checks.every((check) => check.available),
  };
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function buildWarnings(platform: string, binaries: BinaryResult[], appPort: number, appPortAvailable: boolean, previewPortsAvailable: boolean) {
  const warnings = binaries.filter((binary) => binary.required && !binary.version).map((binary) => `${binary.name} is required for the core workflow.`);
  if (!appPortAvailable) warnings.push(`Port ${appPort} is already in use.`);
  if (!previewPortsAvailable) warnings.push("One or more sampled preview ports are already in use.");
  if (platform === "termux") {
    warnings.push("Termux battery optimization may stop long-running sessions.");
    warnings.push("Run termux-wake-lock for long-running work.");
    if (!(await hasSharedStorageAccess())) warnings.push("Run termux-setup-storage if projects live in shared storage.");
  }
  return warnings;
}

async function hasSharedStorageAccess() {
  try {
    await fs.access("/sdcard");
    return true;
  } catch {
    return false;
  }
}
