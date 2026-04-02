import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { AbsoFileWatcherService, AbsoDatChangeEvent } from "./abso-file-watcher.service";
import AbsoSnapshotModel from "../models/mongo/abso-snapshot.model";
import { dbPool } from "../config/db";
import { R1ParsedValues, parseAbsoDat } from "../utils/abso-dat-parser";
import { findFilesInWatchlogDir } from "../utils/scan-watchlog-dir";

const AXES = ["S", "L", "U", "R", "B", "T"] as const;

function valuesEqual(a: R1ParsedValues, b: R1ParsedValues | null | undefined): boolean {
  if (!b) return false;
  return AXES.every((axis) => (a[axis] ?? 0) === (b[axis] ?? 0));
}

export class AbsoDatPipelineService {
  private fileWatcher: AbsoFileWatcherService;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.fileWatcher = new AbsoFileWatcherService();
    this.io = io;
  }

  start(): void {
    this.fileWatcher.start();

    this.fileWatcher.on("abso-dat-change", async (data: AbsoDatChangeEvent) => {
      try {
        await this.processAbsoDat(data);
      } catch (error) {
        console.error("[AbsoDatPipeline] Error processing ABSO.DAT:", error);
      }
    });

    console.log("[AbsoDatPipeline] Started.");
  }

  stop(): void {
    this.fileWatcher.stop();
    console.log("[AbsoDatPipeline] Stopped.");
  }

  async scanAndProcess(): Promise<{ scanned: number; processed: number; errors: string[] }> {
    const files = findFilesInWatchlogDir("ABSO.DAT", "_ABSO");
    const errors: string[] = [];
    let processed = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stats = fs.statSync(filePath);
        const folderName = path.basename(path.dirname(filePath));
        const ipAddress = folderName.replace("_ABSO", "");
        const currValue = parseAbsoDat(content);
        const event: AbsoDatChangeEvent = {
          ipAddress,
          filePath,
          changeType: "added",
          currValue,
          fileModifiedAt: stats.mtime,
        };
        await this.processAbsoDat(event);
        processed++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { scanned: files.length, processed, errors };
  }

  private async processAbsoDat(data: AbsoDatChangeEvent): Promise<void> {
    const { ipAddress, currValue, fileModifiedAt } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[AbsoDatPipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;

    const lastDoc = await AbsoSnapshotModel.findOne({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    const lastValues = lastDoc?.currValue?.R1 as R1ParsedValues | undefined;
    const hasChanged = !valuesEqual(currValue, lastValues);

    if (!hasChanged) {
      console.log(`[AbsoDatPipeline] No change for ${controllerName} (${ipAddress}), skipping insert`);
      return;
    }

    const recordedAt = new Date();
    await AbsoSnapshotModel.create({
      controllerId,
      controllerName,
      currValue: { R1: currValue },
      recordedAt,
    });

    console.log(
      `[AbsoDatPipeline] Saved new AbsoSnapshot for ${controllerName} (${ipAddress}): S=${currValue.S} L=${currValue.L} U=${currValue.U} R=${currValue.R} B=${currValue.B} T=${currValue.T}`
    );

    this.io.to(`controller:${controllerId}`).emit("abso-snapshot:new", {
      controllerId,
      controllerName,
      currValue: { R1: currValue },
      recordedAt: recordedAt.toISOString(),
    });
    this.io.emit("abso-snapshot:update", { controllerId, controllerName });
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
      console.error("[AbsoDatPipeline] Error fetching controller:", error);
      return null;
    }
  }
}
