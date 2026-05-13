import { JsonStore } from "@backend/managers/storage";
import { WorkspaceManager } from "@backend/managers/workspaceManager";
import { createPlatformAdapter } from "@backend/platform/adapter";
import { checkBinaries, defaultBinaryChecks, type BinaryResult } from "@backend/cli/doctor/binaries";
import { checkPreviewPorts, isPortAvailable, type PreviewPortReport } from "@backend/cli/doctor/ports";
import { buildDoctorWarnings } from "@backend/cli/doctor/warnings";

export type DoctorReport = {
  platform: string;
  home: string;
  binaries: BinaryResult[];
  appPort: number;
  appPortAvailable: boolean;
  previewStart: number;
  previewEnd: number;
  previewPorts: PreviewPortReport;
  warnings: string[];
};

export type DoctorProgress = (message: string) => void;

export async function collectDoctorReport(options: { appPort?: number; previewStart?: number; previewEnd?: number; onProgress?: DoctorProgress } = {}): Promise<DoctorReport> {
  const progress = options.onProgress;
  progress?.("Loading workspace settings");
  const store = new JsonStore();
  await store.ensure();
  const adapter = createPlatformAdapter();
  const settings = await new WorkspaceManager(store).getSettings();
  const appPort = options.appPort ?? Number(process.env.CODEX_WEB_PORT || settings.port);
  const previewStart = options.previewStart ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_START || settings.previewPortStart);
  const previewEnd = options.previewEnd ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_END || settings.previewPortEnd);
  progress?.(`Checking binaries: ${defaultBinaryChecks().map((check) => check.command).join(", ")}`);
  const binaries = await checkBinaries(defaultBinaryChecks(), progress);
  progress?.(`Checking app port ${appPort}`);
  const appPortAvailable = await isPortAvailable(appPort);
  progress?.(`Checking preview port sample ${previewStart}-${previewEnd}`);
  const previewPorts = await checkPreviewPorts(previewStart, previewEnd);
  progress?.("Collecting warnings");
  const warnings = await buildDoctorWarnings({
    appPort,
    appPortAvailable,
    binaries,
    platform: adapter.platform,
    previewPortsAvailable: previewPorts.available,
  });

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

export async function collectStartupDoctorWarnings(options: { previewStart: number; previewEnd: number; onProgress?: DoctorProgress }) {
  const adapter = createPlatformAdapter();
  options.onProgress?.("Checking required binaries");
  const binaries = await checkBinaries(
    defaultBinaryChecks().filter((check) => check.required),
    options.onProgress,
  );
  options.onProgress?.(`Checking preview port sample ${options.previewStart}-${options.previewEnd}`);
  const previewPorts = await checkPreviewPorts(options.previewStart, options.previewEnd);
  options.onProgress?.("Collecting startup warnings");
  return buildDoctorWarnings({
    binaries,
    platform: adapter.platform,
    previewPortsAvailable: previewPorts.available,
  });
}
