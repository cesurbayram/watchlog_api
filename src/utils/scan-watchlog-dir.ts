import fs from "fs";
import path from "path";
import os from "os";

export function getWatchlogBaseDir(): string {
  return (
    process.env.WATCHLOG_BASE_DIR ||
    (process.platform === "win32"
      ? path.join("C:", "Watchlog", "UI")
      : path.join(os.homedir(), "Watchlog", "UI"))
  );
}

export function findFilesInWatchlogDir(
  fileName: string,
  folderSuffix: string
): string[] {
  const baseDir = getWatchlogBaseDir();
  const results: string[] = [];

  if (!fs.existsSync(baseDir)) {
    return results;
  }

  function scan(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(fullPath);
      } else if (e.isFile() && e.name === fileName) {
        const parentName = path.basename(dir);
        if (parentName.endsWith(folderSuffix)) {
          results.push(fullPath);
        }
      }
    }
  }

  scan(baseDir);
  return results;
}
