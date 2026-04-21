import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ON_PREM_WATCHLOG_BASE_DIR } from "../config/on-prem-config";

export function getWatchlogBaseDir(): string {
  return ON_PREM_WATCHLOG_BASE_DIR;
}

export function getJobFilePath(ipAddress: string, jobName: string): string {
  const baseDir = getWatchlogBaseDir();
  const folderName = `${ipAddress}_${jobName}`;
  const fileName = `${jobName}.JBI`;
  return path.join(baseDir, folderName, fileName);
}

export function readJobFileContent(ipAddress: string, jobName: string): string | null {
  const filePath = getJobFilePath(ipAddress, jobName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Simple line-based diff for display. Returns unified-diff style string.
 */
export function createSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split(/\r?\n/);
  const newLines = newContent.split(/\r?\n/);
  const result: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      result.push(`+ ${newLine}`);
    } else if (newLine === undefined) {
      result.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      result.push(`- ${oldLine}`);
      result.push(`+ ${newLine}`);
    }
  }

  return result.join("\n");
}

/** Find all *.JBI files in Watchlog. Folder pattern: {ip}_{jobName}/{jobName}.JBI */
export function findJobFilesInWatchlogDir(): string[] {
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
      } else if (e.isFile() && /\.JBI$/i.test(e.name)) {
        results.push(fullPath);
      }
    }
  }

  scan(baseDir);
  return results;
}
