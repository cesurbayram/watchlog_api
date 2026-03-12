import { watch, type FSWatcher } from "chokidar";
import path from "path";
import os from "os";
import fs from "fs";
import { EventEmitter } from "events";
import { parseAbsoDat, R1ParsedValues } from "../utils/abso-dat-parser";

export interface AbsoDatChangeEvent {
  ipAddress: string;
  filePath: string;
  changeType: "added" | "changed";
  currValue: R1ParsedValues;
  fileModifiedAt: Date;
}

export class AbsoFileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir =
      baseDir ||
      process.env.WATCHLOG_BASE_DIR ||
      (process.platform === "win32"
        ? path.join("C:", "Watchlog", "UI")
        : path.join(os.homedir(), "Watchlog", "UI"));
  }

  start(): void {
    if (!fs.existsSync(this.baseDir)) {
      console.warn(`[AbsoFileWatcher] Base directory does not exist: ${this.baseDir}`);
    }

    const watchPattern = path.join(this.baseDir, "**", "ABSO.DAT");

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
      .on("error", (error: unknown) => console.error("[AbsoFileWatcher] Error:", error))
      .on("ready", () => {
        console.log(`[AbsoFileWatcher] Watching for ABSO.DAT changes in: ${this.baseDir}`);
      });
  }

  private handleFileChange(filePath: string, changeType: "added" | "changed"): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);

      const folderName = path.basename(path.dirname(filePath));
      const ipAddress = folderName.replace("_ABSO", "");

      console.log(`[AbsoFileWatcher] ${changeType}: ${folderName}/ABSO.DAT (IP: ${ipAddress})`);

      const currValue = parseAbsoDat(content);

      const event: AbsoDatChangeEvent = {
        ipAddress,
        filePath,
        changeType,
        currValue,
        fileModifiedAt: stats.mtime,
      };

      this.emit("abso-dat-change", event);
    } catch (error) {
      console.error(`[AbsoFileWatcher] Error processing file ${filePath}:`, error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("[AbsoFileWatcher] Stopped.");
    }
  }
}
