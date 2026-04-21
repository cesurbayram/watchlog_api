import { watch, type FSWatcher } from "chokidar";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import { ON_PREM_WATCHLOG_BASE_DIR } from "../config/on-prem-config";

export interface JobFileChangeEvent {
  ipAddress: string;
  jobName: string;
  filePath: string;
  changeType: "added" | "changed";
  content: string;
  fileModifiedAt: Date;
}

export class JobFileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir || ON_PREM_WATCHLOG_BASE_DIR;
  }

  start(): void {
    if (!fs.existsSync(this.baseDir)) {
      console.warn(`[JobFileWatcher] Base directory does not exist: ${this.baseDir}`);
      return;
    }

    const watchPattern = path.join(this.baseDir, "**", "*.JBI");

    this.watcher = watch(watchPattern, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      usePolling: false,
    });

    this.watcher
      .on("add", (filePath: string) => this.handleFileChange(filePath, "added"))
      .on("change", (filePath: string) => this.handleFileChange(filePath, "changed"))
      .on("error", (error: unknown) => console.error("[JobFileWatcher] Error:", error))
      .on("ready", () => {});
  }

  private handleFileChange(filePath: string, changeType: "added" | "changed"): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const jobName = fileName.replace(/\.JBI$/i, "");
      const folderName = path.basename(path.dirname(filePath));
      const escapedJobName = jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ipAddress = folderName.replace(new RegExp(`_${escapedJobName}$`), "");

      console.log(`[JobFileWatcher] ${changeType}: ${folderName}/${fileName} (IP: ${ipAddress})`);

      const event: JobFileChangeEvent = {
        ipAddress,
        jobName,
        filePath,
        changeType,
        content,
        fileModifiedAt: stats.mtime,
      };

      this.emit("job-file-change", event);
    } catch (error) {
      console.error(`[JobFileWatcher] Error processing file ${filePath}:`, error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("[JobFileWatcher] Stopped.");
    }
  }
}
