import { chmod, cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  description?: string;
  engines?: Record<string, string>;
  type?: string;
  version: string;
};

const root = path.resolve(import.meta.dir, "..");
const npmRoot = path.join(root, "dist", "npm");
const packageRoot = path.join(npmRoot, "package");
const pkg = (await Bun.file(path.join(root, "package.json")).json()) as PackageJson;
const npmPackageName = "@keonhokim/codex-web";

await assertExists(path.join(root, "ui", "dist", "index.html"), "Built UI output is required. Run bun run build before preparing the npm package.");
await assertExists(path.join(root, "backend", "src", "cli", "cw.ts"), "Backend CLI source is required.");
await assertExists(path.join(root, "dist", "bin", "cw"), "CLI launcher is required. Run bun run build:package before preparing the npm package.");

await rm(npmRoot, { recursive: true, force: true });
await mkdir(packageRoot, { recursive: true });

await copyDirectory("backend/src", npmBackendSourceFilter);
await copyDirectory("ui/dist");
await copyDirectory("dist/bin");
await copyDirectory("docs");

await copyFile("README.md");
await copyFile("DESIGN.md");
await copyFile("PRODUCT.md");
await copyFile("install.sh");
await copyFile("tsconfig.json");

await writeFile(path.join(packageRoot, "package.json"), JSON.stringify(npmPackageJson(), null, 2) + "\n");
await writeFile(
  path.join(packageRoot, "release-manifest.json"),
  JSON.stringify(
    {
      package: npmPackageName,
      version: pkg.version,
      install: "npm-global-package",
      entrypoint: "dist/bin/cw",
    },
    null,
    2,
  ) + "\n",
);
await chmod(path.join(packageRoot, "dist", "bin", "cw"), 0o755);

console.log(`Prepared npm package at ${path.relative(root, packageRoot)}`);

async function copyDirectory(relativePath: string, filter: (relativePath: string) => boolean = () => true) {
  const sourceRoot = path.join(root, relativePath);
  await cp(path.join(root, relativePath), path.join(packageRoot, relativePath), {
    recursive: true,
    errorOnExist: false,
    filter: (source) => filter(path.relative(sourceRoot, source).split(path.sep).join("/")),
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

function npmPackageJson() {
  return {
    name: npmPackageName,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type,
    bin: pkg.bin,
    files: ["backend/src", "dist/bin", "docs", "install.sh", "tsconfig.json", "ui/dist", "DESIGN.md", "PRODUCT.md", "README.md", "release-manifest.json"],
    engines: pkg.engines,
    dependencies: pkg.dependencies,
    publishConfig: {
      access: "public",
    },
    repository: {
      type: "git",
      url: "git+https://github.com/keonho-kim/codex-web-ide.git",
    },
    bugs: {
      url: "https://github.com/keonho-kim/codex-web-ide/issues",
    },
    homepage: "https://github.com/keonho-kim/codex-web-ide#readme",
  };
}

function npmBackendSourceFilter(relativePath: string) {
  return !relativePath.endsWith(".test.ts") && relativePath !== "testing" && !relativePath.startsWith("testing/");
}
