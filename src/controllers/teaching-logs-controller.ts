import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import { LogEntry } from "../models/log-content";
import { parseLogContent } from "../utils/cmos-backup";
import {
  saveTeachingEvents,
  getTeachingEventsFromDB,
  getDailyStatisticsFromDB,
  getAllControllersSummary,
  getUniqueFileNames,
  hasTeachingData,
} from "../services/teaching-event-service";
import { TeachingEvent as ServiceTeachingEvent } from "../models/teaching-event-dto";
import { TeachingEvent, TeachingStatistics, TeachingLogsResponse } from "../models/teaching-event-dto";

const extractTeachingEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): TeachingEvent[] => {
  const events: TeachingEvent[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    if (event.includes("job edit(p. mod)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "POINT_MODIFICATION",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Point modified in ${entry.fields["FILE NAME"]} at line ${entry.fields["LINE"]}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("job edit(ins)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "INSTRUCTION_INSERT",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Instruction inserted: ${entry.fields["AFTER EDIT"] || "Unknown"}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("job edit(del)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "INSTRUCTION_DELETE",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Instruction deleted: ${entry.fields["DELETED LINE"] || "Unknown"}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("teach mode")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "TEACH_MODE",
        details: "Robot entered teach mode",
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    }
  });

  return events.sort((a, b) => a.index - b.index);
};

const calculateStatistics = (events: TeachingEvent[]): TeachingStatistics => {
  const fileModifications: {
    [key: string]: {
      count: number;
      lastDate: string;
      lastEvent: TeachingEvent;
    };
  } = {};

  events.forEach((event) => {
    if (event.fileName) {
      if (!fileModifications[event.fileName]) {
        fileModifications[event.fileName] = {
          count: 0,
          lastDate: event.date,
          lastEvent: event,
        };
      }
      fileModifications[event.fileName].count += 1;

      if (event.index < fileModifications[event.fileName].lastEvent.index) {
        fileModifications[event.fileName].lastDate = event.date;
        fileModifications[event.fileName].lastEvent = event;
      }
    }
  });

  const mostModifiedFiles = Object.entries(fileModifications)
    .map(([fileName, data]) => ({
      fileName,
      count: data.count,
      lastTeachingDate: data.lastDate,
      lastEvent: data.lastEvent,
    }))
    .sort((a, b) => {
      const dateComparison = new Date(b.lastTeachingDate).getTime() - new Date(a.lastTeachingDate).getTime();
      if (dateComparison !== 0) return dateComparison;
      return b.count - a.count;
    })
    .slice(0, 5);

  return {
    totalTeachingEvents: events.length,
    pointModifications: events.filter((e) => e.type === "POINT_MODIFICATION").length,
    instructionInserts: events.filter((e) => e.type === "INSTRUCTION_INSERT").length,
    instructionDeletes: events.filter((e) => e.type === "INSTRUCTION_DELETE").length,
    teachModeActivations: events.filter((e) => e.type === "TEACH_MODE").length,
    lastTeachingDate: events.length > 0 ? events[0].date : undefined,
    mostModifiedFiles,
  };
};


export const getTeachingLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {

    if (controllerId === "all") {
      return await handleAllControllersTeaching(req, res);
    }

    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];
    const ipAddress = controller.ip_address;
    const controllerName = controller.name;

    const fileName = "LOGDATA.DAT";
    const folderName = `${ipAddress}_LOGDATA`;

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const filePath = path.join(baseDir, folderName, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: "Log file not found. Please fetch log data first.",
        events: [],
        statistics: null,
      });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const stats = fs.statSync(filePath);

    const logEntries = parseLogContent(fileContent);
    const teachingEvents = extractTeachingEvents(logEntries, controllerId, controllerName);
    const statistics = calculateStatistics(teachingEvents);

    let savedToDb = false;
    let newEventsCount = 0;
    try {
      const saveResult = await saveTeachingEvents({
        controllerId,
        events: teachingEvents as ServiceTeachingEvent[],
        fileModifiedAt: stats.mtime,
      });
      savedToDb = true;
      newEventsCount = saveResult.newEventsCount;

    } catch (dbError) {
      console.error("Error saving teaching events to DB:", dbError);
    }

    const response: TeachingLogsResponse = {
      success: true,
      events: teachingEvents,
      statistics,
      controllerId,
      controllerName,
      lastModified: stats.mtime.toISOString(),
      savedToDb,
      newEventsCount,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching teaching logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch teaching logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      statistics: null,
    });
  }
};


const handleAllControllersTeaching = async (req: Request, res: Response) => {
  try {
    const controllersQuery = `SELECT id, ip_address, name FROM controller ORDER BY name`;
    const controllersResult = await dbPool.query(controllersQuery);

    if (controllersResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No controllers found in the system",
        events: [],
        statistics: null,
      });
    }

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const fileName = "LOGDATA.DAT";
    let allTeachingEvents: TeachingEvent[] = [];
    let lastModifiedDate: Date | null = null;
    let totalNewEvents = 0;

    for (const controller of controllersResult.rows) {
      const folderName = `${controller.ip_address}_LOGDATA`;
      const filePath = path.join(baseDir, folderName, fileName);

      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const stats = fs.statSync(filePath);

          if (!lastModifiedDate || stats.mtime > lastModifiedDate) {
            lastModifiedDate = stats.mtime;
          }

          const logEntries = parseLogContent(fileContent);
          const teachingEvents = extractTeachingEvents(logEntries, controller.id, controller.name);
          allTeachingEvents = allTeachingEvents.concat(teachingEvents);


          try {
            const saveResult = await saveTeachingEvents({
              controllerId: controller.id,
              events: teachingEvents as ServiceTeachingEvent[],
              fileModifiedAt: stats.mtime,
            });
            totalNewEvents += saveResult.newEventsCount;
          } catch (dbError) {
            console.error(`Error saving teaching events for ${controller.name}:`, dbError);
          }
        } catch (error) {
          console.error(`Error reading log for controller ${controller.name}:`, error);
        }
      }
    }

    allTeachingEvents.sort((a, b) => a.index - b.index);

    const statistics = calculateStatistics(allTeachingEvents);

    const response: TeachingLogsResponse = {
      success: true,
      events: allTeachingEvents,
      statistics,
      lastModified: lastModifiedDate?.toISOString() || new Date().toISOString(),
      savedToDb: true,
      newEventsCount: totalNewEvents,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating teaching logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate teaching logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      statistics: null,
    });
  }
};


export const getTeachingEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, eventType, fileName, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {

    if (controllerId === "all") {
      return await getAllControllersSummaryEndpoint(req, res);
    }

    const result = await getTeachingEventsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
      eventType: eventType as string,
      fileName: fileName as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    const events = result.events.map((e) => ({
      index: e.event_index,
      date: e.event_date ? e.event_date.toISOString() : "",
      type: e.event_type,
      fileName: e.file_name,
      lineNumber: e.line_number,
      details: e.details,
      rawEntry: e.raw_entry,
      controllerId: e.controller_id,
    }));

    return res.status(200).json({
      success: true,
      events,
      total: result.total,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
  } catch (error) {
    console.error("Error getting teaching events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get teaching events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};


export const getTeachingHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const stats = await getDailyStatisticsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: (groupBy as "day" | "week" | "month") || "day",
    });

    return res.status(200).json({
      success: true,
      statistics: stats,
      controllerId,
      groupBy: groupBy || "day",
    });
  } catch (error) {
    console.error("Error getting teaching history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get teaching history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};


export const getAllControllersSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await getAllControllersSummary();

    return res.status(200).json({
      success: true,
      controllers: summary,
      total: summary.length,
    });
  } catch (error) {
    console.error("Error getting controllers summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get controllers summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};


export const getTeachingFileNames = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const fileNames = await getUniqueFileNames(controllerId);

    return res.status(200).json({
      success: true,
      fileNames,
    });
  } catch (error) {
    console.error("Error getting file names:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get file names: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};


export const checkTeachingData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await hasTeachingData(controllerId);

    return res.status(200).json({
      success: true,
      hasData,
      controllerId,
    });
  } catch (error) {
    console.error("Error checking teaching data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check teaching data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
