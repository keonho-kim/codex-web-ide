import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const cacheRoot = join(repoRoot, ".cache", "playwright-libs");
const debDir = join(cacheRoot, "debs");
const rootDir = join(cacheRoot, "root");

function run(command: string, args: string[], cwd = repoRoot) {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.exitCode}`);
  }
}

function tryRun(command: string, args: string[], cwd = repoRoot, inheritOutput = false) {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: inheritOutput ? "inherit" : "ignore",
    stderr: inheritOutput ? "inherit" : "ignore",
  });

  return result.exitCode === 0;
}

mkdirSync(debDir, { recursive: true });
mkdirSync(rootDir, { recursive: true });

run("bunx", ["playwright", "install", "chromium"]);

if (process.platform !== "linux") {
  console.log("Skipping Linux shared library extraction on non-Linux platform.");
  process.exit(0);
}

if (!tryRun("apt-get", ["--version"])) {
  throw new Error("apt-get is required to download Chromium shared libraries on Linux.");
}

if (!tryRun("dpkg-deb", ["--version"])) {
  throw new Error("dpkg-deb is required to extract Chromium shared libraries on Linux.");
}

const basePackages = ["libnspr4", "libnss3"];
const audioPackage = tryRun("apt-get", ["download", ...basePackages, "libasound2t64"], debDir, true)
  ? "libasound2t64"
  : "libasound2";

if (audioPackage === "libasound2") {
  run("apt-get", ["download", ...basePackages, audioPackage], debDir);
}

for (const debFile of readdirSync(debDir)) {
  if (debFile.endsWith(".deb")) {
    run("dpkg-deb", ["-x", join(debDir, debFile), rootDir]);
  }
}

const libPath = join(rootDir, "usr", "lib", "x86_64-linux-gnu");
if (!existsSync(libPath)) {
  throw new Error(`Expected Chromium shared libraries at ${libPath}`);
}

console.log(`Playwright Chromium is ready. LD_LIBRARY_PATH=${libPath}`);
