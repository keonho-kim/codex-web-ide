import { execa } from "execa";

export type BinaryCheck = {
  name: string;
  command: string;
  versionArgs: string[];
  required: boolean;
};

export type BinaryResult = BinaryCheck & {
  version: string | null;
};

export function defaultBinaryChecks(): BinaryCheck[] {
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

export async function checkBinaries(checks: BinaryCheck[], onProgress?: (message: string) => void): Promise<BinaryResult[]> {
  return Promise.all(
    checks.map(async (check) => {
      onProgress?.(`Checking ${check.name} (${check.command})`);
      const version = await binaryVersion(check.command, check.versionArgs);
      onProgress?.(`${check.name}: ${version ? "found" : "missing"}`);
      return {
        ...check,
        version,
      };
    }),
  );
}

async function binaryVersion(name: string, versionArgs: string[]) {
  try {
    const { stdout, stderr } = await execa(name, versionArgs, { timeout: 8_000 });
    return (stdout || stderr).split("\n")[0] || null;
  } catch {
    return null;
  }
}
