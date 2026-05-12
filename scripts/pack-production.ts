import { chmod, cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

type PackageJson = {
  name: string;
  version: string;
  description?: string;
  type?: string;
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
};

const root = path.resolve(import.meta.dir, "..");
const pkg = (await Bun.file(path.join(root, "package.json")).json()) as PackageJson;
const target = resolveTarget();
const releaseRoot = path.join(root, "dist", "release");
const packageRoot = path.join(releaseRoot, pkg.name);
const outputPath = path.join(root, "dist", `${pkg.name}-${pkg.version}-${target}.tgz`);

await assertExists(path.join(root, "ui", "dist", "index.html"), "Built UI output is required. Run bun run build before packaging.");
await assertExists(path.join(root, "backend", "src", "cli", "cw.ts"), "Backend CLI source is required.");
await assertExists(path.join(root, "node_modules"), "node_modules is required. Run bun install before packaging.");
await assertExists(path.join(root, "node_modules", "node-pty"), "node-pty must be installed before packaging.");

await rm(packageRoot, { recursive: true, force: true });
await rm(outputPath, { force: true });
await mkdir(packageRoot, { recursive: true });

await copyDirectory("backend/src");
await copyDirectory("ui/dist");
await copyDirectory("dist/bin");
await copyDirectory("docs");
await copyDirectory("node_modules");

await copyFile("README.md");
await copyFile("DESIGN.md");
await copyFile("PRODUCT.md");

await writeFile(path.join(packageRoot, "package.json"), JSON.stringify(productionPackageJson(), null, 2) + "\n");
await writeFile(
  path.join(packageRoot, "release-manifest.json"),
  JSON.stringify(
    {
      package: pkg.name,
      version: pkg.version,
      target,
      artifact: path.basename(outputPath),
      install: "portable-production-archive",
      includesNodeModules: true,
      entrypoint: "dist/bin/cw",
    },
    null,
    2,
  ) + "\n",
);
await chmod(path.join(packageRoot, "dist", "bin", "cw"), 0o755);

await run("tar", ["-czf", outputPath, "-C", releaseRoot, pkg.name]);

console.log(`Prepared production release archive at ${path.relative(root, outputPath)}`);

function resolveTarget() {
  const fromEnv = process.env.CW_RELEASE_TARGET;
  const argTarget = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
  const value = argTarget || fromEnv || `${process.platform}-${process.arch}`;
  if (!/^[a-z0-9]+-[a-z0-9]+$/.test(value)) {
    throw new Error(`Invalid release target: ${value}`);
  }
  return value;
}

async function copyDirectory(relativePath: string) {
  await cp(path.join(root, relativePath), path.join(packageRoot, relativePath), {
    recursive: true,
    errorOnExist: false,
    force: true,
  });
}

async function copyFile(relativePath: string) {
  await cp(path.join(root, relativePath), path.join(packageRoot, relativePath), {
    force: true,
  });
}

async function assertExists(filePath: string, message: string) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(message);
  }
}

function productionPackageJson(): PackageJson {
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type,
    bin: pkg.bin,
    engines: pkg.engines,
    dependencies: pkg.dependencies,
  };
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}
