import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { AlarmFileWatcherService, AlarmDatChangeEvent } from "./alarm-file-watcher.service";
import AlarmSnapshotModel from "../models/mongo/alarm-snapshot.model";
import { dbPool } from "../config/db";
import { ParsedAlmhist, parseAlmhistDat } from "../utils/almhist-dat-parser";
import { findFilesInWatchlogDir } from "../utils/scan-watchlog-dir";

function almhistEqual(a: ParsedAlmhist, b: ParsedAlmhist | null | undefined): boolean {
  if (!b || !b.categories) return false;
  if (a.categories.length !== b.categories.length) return false;
  for (let i = 0; i < a.categories.length; i++) {
    const ca = a.categories[i];
    const cb = b.categories[i];
    if (!cb) return false;
    if (ca.name !== cb.name || ca.currentCount !== cb.currentCount || ca.alarms.length !== cb.alarms.length)
      return false;
    for (let j = 0; j < ca.alarms.length; j++) {
      const aa = ca.alarms[j];
      const ab = cb.alarms[j];
      if (!ab || aa.code !== ab.code || aa.recordedAt !== ab.recordedAt) return false;
    }
  }
  return true;
}

export class AlarmDatPipelineService {
  private fileWatcher: AlarmFileWatcherService;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.fileWatcher = new AlarmFileWatcherService();
    this.io = io;
  }

  start(): void {
    this.fileWatcher.start();

    this.fileWatcher.on("alarm-dat-change", async (data: AlarmDatChangeEvent) => {
      try {
        await this.processAlarmDat(data);
      } catch (error) {
        console.error("[AlarmDatPipeline] Error processing ALMHIST.DAT:", error);
      }
    });

    console.log("[AlarmDatPipeline] Started.");
  }

  stop(): void {
    this.fileWatcher.stop();
    console.log("[AlarmDatPipeline] Stopped.");
  }

  /** Manually scan directory and process all ALMHIST.DAT files (workaround when file watcher fails). */
  async scanAndProcess(): Promise<{ scanned: number; processed: number; errors: string[] }> {
    const files = findFilesInWatchlogDir("ALMHIST.DAT", "_ALMHIST");
    const errors: string[] = [];
    let processed = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stats = fs.statSync(filePath);
        const folderName = path.basename(path.dirname(filePath));
        const ipAddress = folderName.replace("_ALMHIST", "");
        const parsed = parseAlmhistDat(content);
        const event: AlarmDatChangeEvent = {
          ipAddress,
          filePath,
          changeType: "added",
          parsed,
          fileModifiedAt: stats.mtime,
        };
        await this.processAlarmDat(event);
        processed++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[AlarmDatPipeline] Manual scan: ${files.length} files found, ${processed} processed`);
    return { scanned: files.length, processed, errors };
  }

  private async processAlarmDat(data: AlarmDatChangeEvent): Promise<void> {
    const { ipAddress, parsed } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[AlarmDatPipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;

    const lastDoc = await AlarmSnapshotModel.findOne({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    const lastParsed: ParsedAlmhist | null = lastDoc?.categories
      ? { categories: lastDoc.categories as ParsedAlmhist["categories"] }
      : null;
    const hasChanged = !almhistEqual(parsed, lastParsed);

    if (!hasChanged) {
      console.log(`[AlarmDatPipeline] No change for ${controllerName} (${ipAddress}), skipping insert`);
      return;
    }

    const categoriesData = parsed.categories.map((c) => ({
      name: c.name,
      maxCapacity: c.maxCapacity,
      currentCount: c.currentCount,
      alarms: c.alarms,
    }));

    const recordedAt = new Date();
    await AlarmSnapshotModel.create({
      controllerId,
      controllerName,
      categories: categoriesData,
      recordedAt,
    });

    const totalAlarms = parsed.categories.reduce((sum, c) => sum + c.alarms.length, 0);
    console.log(
      `[AlarmDatPipeline] Saved new AlarmSnapshot for ${controllerName} (${ipAddress}): ${totalAlarms} alarms across ${parsed.categories.length} categories`
    );

    this.io.to(`controller:${controllerId}`).emit("alarm-snapshot:new", {
      controllerId,
      controllerName,
      categories: categoriesData,
      recordedAt: recordedAt.toISOString(),
    });
    this.io.emit("alarm-snapshot:update", { controllerId, controllerName });
  }

  private async getControllerByIP(
    ipAddress: string
  ): Promise<{ id: string; name: string; ip_address: string } | null> {
    try {
      const result = await dbPool.query(
        `SELECT id, ip_address, name FROM controller WHERE ip_address = $1`,
        [ipAddress]
      );
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error("[AlarmDatPipeline] Error fetching controller:", error);
      return null;
    }
  }
}
