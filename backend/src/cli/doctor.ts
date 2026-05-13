import { collectDoctorReport } from "@backend/cli/doctor/checks";

export async function runDoctor() {
  console.log("codex-web doctor");
  console.log("");
  const report = await collectDoctorReport({
    onProgress: (message) => console.log(`${label("Check")} ${message}`),
  });
  console.log("");
  console.log(`${label("Platform")} ${report.platform}`);
  console.log(`${label("Home")} ${report.home}`);
  for (const result of report.binaries) {
    console.log(`${label(result.name)} ${result.version ? `found (${result.version})` : "missing"}`);
  }
  console.log(`${label("Port")} ${report.appPort} ${report.appPortAvailable ? "available" : "in use"}`);
  console.log(`${label("Preview")} ${report.previewStart}-${report.previewEnd} ${report.previewPorts.available ? "available" : "partially in use"} (${report.previewPorts.sampled.join(", ")})`);

  if (report.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }
}

function label(name: string) {
  return `${name}:`.padEnd(10);
}
