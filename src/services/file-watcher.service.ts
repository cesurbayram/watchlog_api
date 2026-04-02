import { watch, type FSWatcher } from "chokidar";
import path from "path";
import os from "os";
import fs from "fs";
import { EventEmitter } from "events";
import { parseLogContent } from "../utils/cmos-backup";
import { LogEntry } from "../models/log-content";

export interface LogDataChangeEvent {
  ipAddress: string;
  filePath: string;
  changeType: "added" | "changed";
  logEntries: LogEntry[];
  fileModifiedAt: Date;
}

export class FileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir =
      baseDir ||
      process.env.WATCHLOG_BASE_DIR ||
      (process.platform === "win32" ? path.join("C:", "Watchlog", "UI") : path.join(os.homedir(), "Watchlog", "UI"));
  }

  start(): void {
    if (!fs.existsSync(this.baseDir)) {
      console.warn(`[FileWatcher] Base directory does not exist: ${this.baseDir}`);
      console.warn("[FileWatcher] Watcher will start but wait for the directory to appear.");
    }

    const watchPattern = path.join(this.baseDir, "**", "LOGDATA.DAT");

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
      .on("error", (error: unknown) => console.error("[FileWatcher] Error:", error))
      .on("ready", () => {});
  }

  private handleFileChange(filePath: string, changeType: "added" | "changed"): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);

      const folderName = path.basename(path.dirname(filePath));
      const ipAddress = folderName.replace("_LOGDATA", "");

      console.log(`[FileWatcher] ${changeType}: ${folderName}/LOGDATA.DAT (IP: ${ipAddress})`);

      const logEntries = parseLogContent(content);

      const event: LogDataChangeEvent = {
        ipAddress,
        filePath,
        changeType,
        logEntries,
        fileModifiedAt: stats.mtime,
      };

      this.emit("log-data-change", event);
    } catch (error) {
      console.error(`[FileWatcher] Error processing file ${filePath}:`, error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("[FileWatcher] Stopped.");
    }
  }
}
