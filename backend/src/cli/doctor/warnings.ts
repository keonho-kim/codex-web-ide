import type { BinaryResult } from "@backend/cli/doctor/binaries";
import { hasSharedStorageAccess } from "@backend/cli/doctor/storage";

export async function buildDoctorWarnings({
  appPort,
  appPortAvailable,
  binaries,
  platform,
  previewPortsAvailable,
}: {
  appPort?: number;
  appPortAvailable?: boolean;
  binaries: BinaryResult[];
  platform: string;
  previewPortsAvailable: boolean;
}) {
  const warnings = binaries.filter((binary) => binary.required && !binary.version).map((binary) => `${binary.name} is required for the core workflow.`);
  if (appPort !== undefined && appPortAvailable === false) warnings.push(`Port ${appPort} is already in use.`);
  if (!previewPortsAvailable) warnings.push("One or more sampled preview ports are already in use.");
  if (platform === "termux") {
    warnings.push("Termux battery optimization may stop long-running sessions.");
    warnings.push("Run termux-wake-lock for long-running work.");
    if (!(await hasSharedStorageAccess())) warnings.push("Run termux-setup-storage if projects live in shared storage.");
  }
  return warnings;
}
