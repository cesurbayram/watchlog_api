import { watch, type FSWatcher } from "chokidar";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import { parseToolCnd, ParsedTool } from "../utils/tool-cnd-parser";
import { ON_PREM_WATCHLOG_BASE_DIR } from "../config/on-prem-config";

export interface ToolCndChangeEvent {
  ipAddress: string;
  filePath: string;
  changeType: "added" | "changed";
  tools: ParsedTool[];
  fileModifiedAt: Date;
}

export class ToolFileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir || ON_PREM_WATCHLOG_BASE_DIR;
  }

  start(): void {
    if (!fs.existsSync(this.baseDir)) {
      console.warn(`[ToolFileWatcher] Base directory does not exist: ${this.baseDir}`);
    }

    const watchPattern = path.join(this.baseDir, "**", "TOOL.CND");

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
      .on("error", (error: unknown) => console.error("[ToolFileWatcher] Error:", error))
      .on("ready", () => {});
  }

  private handleFileChange(filePath: string, changeType: "added" | "changed"): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);

      const folderName = path.basename(path.dirname(filePath));
      const ipAddress = folderName.replace("_TOOL", "");

      console.log(`[ToolFileWatcher] ${changeType}: ${folderName}/TOOL.CND (IP: ${ipAddress})`);

      const { tools } = parseToolCnd(content);

      const event: ToolCndChangeEvent = {
        ipAddress,
        filePath,
        changeType,
        tools,
        fileModifiedAt: stats.mtime,
      };

      this.emit("tool-cnd-change", event);
    } catch (error) {
      console.error(`[ToolFileWatcher] Error processing file ${filePath}:`, error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("[ToolFileWatcher] Stopped.");
    }
  }
}
