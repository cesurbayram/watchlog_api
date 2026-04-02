import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { FileWatcherService, LogDataChangeEvent } from "./file-watcher.service";
import { extractTeachingEvents } from "./teaching-parser.service";
import TeachingEventModel from "../models/mongo/teaching-event.model";
import { dbPool } from "../config/db";
import { parseLogContent } from "../utils/cmos-backup";
import { findFilesInWatchlogDir } from "../utils/scan-watchlog-dir";

const parseEventDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const [datePart, timePart] = dateStr.trim().split(" ");
    if (datePart && timePart) {
      const [year, month, day] = datePart.split("/");
      if (!year || !month || !day) return null;
      const paddedMonth = month.padStart(2, "0");
      const paddedDay = day.padStart(2, "0");
      const timeFormatted = timePart.includes(":") ? timePart : timePart + ":00";
      const parsed = new Date(`${year}-${paddedMonth}-${paddedDay}T${timeFormatted}`);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export class LogPipelineService {
  private fileWatcher: FileWatcherService;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.fileWatcher = new FileWatcherService();
    this.io = io;
  }

  start(): void {
    this.fileWatcher.start();

    this.fileWatcher.on("log-data-change", async (data: LogDataChangeEvent) => {
      try {
        await this.processLogData(data);
      } catch (error) {
        console.error("[Pipeline] Error processing log data:", error);
      }
    });

    console.log("[Pipeline] Log pipeline started.");
  }

  stop(): void {
    this.fileWatcher.stop();
    console.log("[Pipeline] Log pipeline stopped.");
  }

  async scanAndProcess(): Promise<{ scanned: number; processed: number; errors: string[] }> {
    const files = findFilesInWatchlogDir("LOGDATA.DAT", "_LOGDATA");
    const errors: string[] = [];
    let processed = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stats = fs.statSync(filePath);
        const folderName = path.basename(path.dirname(filePath));
        const ipAddress = folderName.replace("_LOGDATA", "");
        const logEntries = parseLogContent(content);
        const event: LogDataChangeEvent = {
          ipAddress,
          filePath,
          changeType: "added",
          logEntries,
          fileModifiedAt: stats.mtime,
        };
        await this.processLogData(event);
        processed++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { scanned: files.length, processed, errors };
  }

  private async processLogData(data: LogDataChangeEvent): Promise<void> {
    const { ipAddress, logEntries } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[Pipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;

    const newTeachingEvents = await this.processTeachingEvents(logEntries, controllerId, controllerName);

    if (newTeachingEvents.length > 0) {
      this.io.to(`controller:${controllerId}`).emit("teaching-events:new", {
        controllerId,
        controllerName,
        events: newTeachingEvents,
        count: newTeachingEvents.length,
      });
      this.io.emit("teaching-events:update", { controllerId, controllerName, count: newTeachingEvents.length });
      console.log(`[Pipeline] Pushed ${newTeachingEvents.length} new Teaching events for ${controllerName}`);
    }
  }

  private async processTeachingEvents(logEntries: any[], controllerId: string, controllerName: string) {
    const teachingEvents = extractTeachingEvents(logEntries, controllerId, controllerName);
    const newEvents: any[] = [];

    for (const event of teachingEvents) {
      try {
        const eventDate = parseEventDate(event.date);
        const existing = await TeachingEventModel.findOne({
          controllerId: event.controllerId,
          eventDate,
          eventType: event.type,
          details: event.details,
        }).lean();

        if (!existing) {
          await TeachingEventModel.create({
            controllerId: event.controllerId,
            controllerName: event.controllerName,
            eventIndex: event.index,
            eventDate: parseEventDate(event.date),
            eventType: event.type,
            fileName: event.fileName,
            lineNumber: event.lineNumber,
            details: event.details,
            rawEntry: event.rawEntry,
          });
          newEvents.push(event);
        }
      } catch (err: any) {
        if (err.code !== 11000) {
          console.error("[Pipeline] Error saving Teaching event:", err.message);
        }
      }
    }

    return newEvents;
  }

  private async getControllerByIP(ipAddress: string): Promise<{ id: string; name: string; ip_address: string } | null> {
    try {
      const result = await dbPool.query(`SELECT id, ip_address, name FROM controller WHERE ip_address = $1`, [ipAddress]);
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error("[Pipeline] Error fetching controller:", error);
      return null;
    }
  }
}
