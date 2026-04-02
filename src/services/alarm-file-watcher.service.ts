import { watch, type FSWatcher } from "chokidar";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import { parseAlmhistDat, ParsedAlmhist } from "../utils/almhist-dat-parser.js";
import { ON_PREM_WATCHLOG_BASE_DIR } from "../config/on-prem-config.js";

export interface AlarmDatChangeEvent {
  ipAddress: string;
  filePath: string;
  changeType: "added" | "changed";
  parsed: ParsedAlmhist;
  fileModifiedAt: Date;
}

export class AlarmFileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir || ON_PREM_WATCHLOG_BASE_DIR;
  }

  start(): void {
    if (!fs.existsSync(this.baseDir)) {
      console.warn(`[AlarmFileWatcher] Base directory does not exist: ${this.baseDir}`);
    }

    const watchPattern = path.join(this.baseDir, "**", "ALMHIST.DAT");

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
      .on("error", (error: unknown) => console.error("[AlarmFileWatcher] Error:", error))
      .on("ready", () => {});
  }

  private handleFileChange(filePath: string, changeType: "added" | "changed"): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);

      const folderName = path.basename(path.dirname(filePath));
      const ipAddress = folderName.replace("_ALMHIST", "");

      console.log(`[AlarmFileWatcher] ${changeType}: ${folderName}/ALMHIST.DAT (IP: ${ipAddress})`);

      const parsed = parseAlmhistDat(content);

      const event: AlarmDatChangeEvent = {
        ipAddress,
        filePath,
        changeType,
        parsed,
        fileModifiedAt: stats.mtime,
      };

      this.emit("alarm-dat-change", event);
    } catch (error) {
      console.error(`[AlarmFileWatcher] Error processing file ${filePath}:`, error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("[AlarmFileWatcher] Stopped.");
    }
  }
}
