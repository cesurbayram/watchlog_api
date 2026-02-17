import { Server as SocketIOServer } from "socket.io";
import { FileWatcherService, LogDataChangeEvent } from "./file-watcher.service";
import { extractTCPDataEvents } from "./tcp-parser.service";
import { extractTeachingEvents } from "./teaching-parser.service";
import { extractAbsoluteDataEvents } from "./abso-parser.service";
import TCPEventModel from "../models/mongo/tcp-event.model";
import TeachingEventModel from "../models/mongo/teaching-event.model";
import AbsoEventModel from "../models/mongo/abso-event.model";
import { dbPool } from "../config/db";

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

  private async processLogData(data: LogDataChangeEvent): Promise<void> {
    const { ipAddress, logEntries } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[Pipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;

    console.log(`[Pipeline] Processing ${logEntries.length} log entries for ${controllerName} (${ipAddress})`);

    const [newTcpEvents, newTeachingEvents, newAbsoEvents] = await Promise.all([
      this.processTCPEvents(logEntries, controllerId, controllerName),
      this.processTeachingEvents(logEntries, controllerId, controllerName),
      this.processAbsoEvents(logEntries, controllerId, controllerName),
    ]);

    if (newTcpEvents.length > 0) {
      this.io.to(`controller:${controllerId}`).emit("tcp-events:new", {
        controllerId,
        controllerName,
        events: newTcpEvents,
        count: newTcpEvents.length,
      });
      this.io.emit("tcp-events:update", { controllerId, controllerName, count: newTcpEvents.length });
      console.log(`[Pipeline] Pushed ${newTcpEvents.length} new TCP events for ${controllerName}`);
    }

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

    if (newAbsoEvents.length > 0) {
      this.io.to(`controller:${controllerId}`).emit("abso-events:new", {
        controllerId,
        controllerName,
        events: newAbsoEvents,
        count: newAbsoEvents.length,
      });
      this.io.emit("abso-events:update", { controllerId, controllerName, count: newAbsoEvents.length });
      console.log(`[Pipeline] Pushed ${newAbsoEvents.length} new Abso events for ${controllerName}`);
    }
  }

  private async processTCPEvents(logEntries: any[], controllerId: string, controllerName: string) {
    const tcpEvents = extractTCPDataEvents(logEntries, controllerId, controllerName);
    const newEvents: any[] = [];

    for (const event of tcpEvents) {
      try {
        const eventDate = parseEventDate(event.date);
        const existing = await TCPEventModel.findOne({
          controllerId: event.controllerId,
          eventDate,
          event: event.event,
          elementNumber: event.elementNumber,
        }).lean();

        if (!existing) {
          await TCPEventModel.create({
            controllerId: event.controllerId,
            controllerName: event.controllerName,
            eventIndex: event.index,
            eventDate: parseEventDate(event.date),
            event: event.event,
            fileName: event.fileName,
            elementNumber: event.elementNumber,
            elementValue: event.elementValue,
            parsedElement: event.parsedElement,
            rawEntry: event.rawEntry,
          });
          newEvents.push(event);
        }
      } catch (err: any) {
        if (err.code !== 11000) {
          console.error("[Pipeline] Error saving TCP event:", err.message);
        }
      }
    }

    return newEvents;
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

  private async processAbsoEvents(logEntries: any[], controllerId: string, controllerName: string) {
    const absoEvents = extractAbsoluteDataEvents(logEntries, controllerId, controllerName);
    const newEvents: any[] = [];

    for (const event of absoEvents) {
      try {
        const eventDate = parseEventDate(event.date);
        const existing = await AbsoEventModel.findOne({
          controllerId: event.controllerId,
          eventDate,
          groupNumber: event.groupNumber,
          axisNumber: event.axisNumber,
        }).lean();

        if (!existing) {
          await AbsoEventModel.create({
            controllerId: event.controllerId,
            controllerName: event.controllerName,
            eventIndex: event.index,
            eventDate: parseEventDate(event.date),
            groupNumber: event.groupNumber,
            axisNumber: event.axisNumber,
            setValue: event.setValue,
            currValue: event.currValue,
            rawEntry: event.rawEntry,
          });
          newEvents.push(event);
        }
      } catch (err: any) {
        if (err.code !== 11000) {
          console.error("[Pipeline] Error saving Abso event:", err.message);
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
