import fs from "node:fs/promises";

export async function hasSharedStorageAccess() {
  try {
    await fs.access("/sdcard");
    return true;
  } catch {
    return false;
  }
}
