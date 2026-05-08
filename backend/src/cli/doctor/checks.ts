import { JsonStore } from "../../managers/storage";
import { WorkspaceManager } from "../../managers/workspaceManager";
import { createPlatformAdapter } from "../../platform/adapter";
import { checkBinaries, defaultBinaryChecks, type BinaryResult } from "./binaries";
import { checkPreviewPorts, isPortAvailable, type PreviewPortReport } from "./ports";
import { buildDoctorWarnings } from "./warnings";

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

export async function collectDoctorReport(options: { appPort?: number; previewStart?: number; previewEnd?: number } = {}): Promise<DoctorReport> {
  const adapter = createPlatformAdapter();
  const settings = await new WorkspaceManager(new JsonStore()).getSettings();
  const appPort = options.appPort ?? Number(process.env.CODEX_WEB_PORT || settings.port);
  const previewStart = options.previewStart ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_START || settings.previewPortStart);
  const previewEnd = options.previewEnd ?? Number(process.env.CODEX_WEB_PREVIEW_PORT_END || settings.previewPortEnd);
  const binaries = await checkBinaries(defaultBinaryChecks());
  const appPortAvailable = await isPortAvailable(appPort);
  const previewPorts = await checkPreviewPorts(previewStart, previewEnd);
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

export async function collectStartupDoctorWarnings(options: { previewStart: number; previewEnd: number }) {
  const adapter = createPlatformAdapter();
  const binaries = await checkBinaries(defaultBinaryChecks().filter((check) => check.required));
  const previewPorts = await checkPreviewPorts(options.previewStart, options.previewEnd);
  return buildDoctorWarnings({
    binaries,
    platform: adapter.platform,
    previewPortsAvailable: previewPorts.available,
  });
}
