import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import { LogEntry } from "../models/log-content";
import { parseLogContent } from "../utils/cmos-backup";
import {
  saveTCPEvents,
  getTCPEventsFromDB,
  getDailyTCPStatisticsFromDB,
  getAllControllersTCPSummary,
  hasTCPData,
  TCPEvent as ServiceTCPEvent,
} from "../services/tcp-event-service";

// Types
interface ParsedElement {
  toolNumber: number;
  parameterGroup: number;
  parameterGroupName: string;
  parameterIndex: number;
  parameterName: string;
  actualToolNumber: number;
}

interface TCPDataEntry {
  index: number;
  date: string;
  event: string;
  fileName: string;
  elementNumber: string;
  elementValue: string;
  parsedElement: ParsedElement;
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

interface TCPComparison {
  toolNumber: number;
  parameterName: string;
  parameterGroupName: string;
  elementNumber: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

interface TCPStatistics {
  totalTCPChanges: number;
  toolsModified: number;
  uniqueTools: string[];
  lastChangeDate?: string;
  changesByParameter: Record<string, number>;
}

interface TCPLogsResponse {
  success: boolean;
  events: TCPDataEntry[];
  comparisons: TCPComparison[];
  statistics: TCPStatistics | null;
  error?: string;
  controllerId?: string;
  controllerName?: string;
  lastModified?: string;
  savedToDb?: boolean;
  newEventsCount?: number;
}

// Parse element number to get tool and parameter info
const parseElementNumber = (elementNumber: string): ParsedElement | null => {
  const parts = elementNumber.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const N = parseInt(parts[0]);
  const M = parseInt(parts[1]);
  const K = parseInt(parts[2]);

  let parameterName = "Unknown";
  let parameterGroupName = "Unknown";

  if (M === 1) {
    const toolDataNames = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
    parameterName = toolDataNames[K] || "Unknown";
    parameterGroupName = "TOOL Data";
  } else if (M === 2) {
    const toolDataNames = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
    parameterName = toolDataNames[K] || "Unknown";
    parameterGroupName = "TOOL Data (M=2)";
  } else if (M === 9) {
    const toolGeometryNames = ["Xg", "Yg", "Zg", "Ix", "Iy", "Iz"];
    parameterName = toolGeometryNames[K] || "Unknown";
    parameterGroupName = "TOOL Geometry";
  }

  return {
    toolNumber: N,
    parameterGroup: M,
    parameterGroupName,
    parameterIndex: K,
    parameterName,
    actualToolNumber: N - 1,
  };
};

// Extract TCP data events from log entries
const extractTCPDataEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): TCPDataEntry[] => {
  const events: TCPDataEntry[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    const fields = entry.fields || {};
    const fileNameFieldKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "file name");
    const elementNumberKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "element number");
    const elementValueKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "element value");
    const afterEditKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "after edit");

    let fileName = (fileNameFieldKey ? fields[fileNameFieldKey] : "") || "";
    let elementNumber = (elementNumberKey ? fields[elementNumberKey] : "") || "";
    let elementValue = (elementValueKey ? fields[elementValueKey] : "") || "";
    const afterEdit = (afterEditKey ? fields[afterEditKey] : "") || "";

    if (!elementValue && afterEdit) {
      elementValue = afterEdit;
    }

    // Fallback parsing from raw data
    if (!fileName && entry.rawData) {
      const m = entry.rawData.match(/FILE NAME\s*:\s*(\S+)/i);
      if (m) fileName = m[1];
    }
    if (!elementNumber && entry.rawData) {
      const m = entry.rawData.match(/ELEMENT NUMBER\s*:\s*([\d-]+)/i);
      if (m) elementNumber = m[1];
    }
    if (!elementValue && entry.rawData) {
      const m = entry.rawData.match(/ELEMENT VALUE\s*:\s*([-+]?\d+(?:\.\d+)?)/i);
      if (m) elementValue = m[1];
    }

    if ((event.includes("other file edit") || event.includes("other file edt")) && fileName.toLowerCase() === "tool") {
      const parsedElement = parseElementNumber(elementNumber);

      if (parsedElement) {
        events.push({
          index: entry.index,
          date: entry.date || "",
          event: entry.event || "",
          fileName,
          elementNumber,
          elementValue,
          parsedElement,
          rawEntry: entry.rawData,
          controllerId,
          controllerName,
        });
      }
    }
  });

  return events.sort((a, b) => {
    if (a.date && b.date) {
      const dateA = new Date(a.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
      const dateB = new Date(b.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
      return dateB.getTime() - dateA.getTime();
    }
    return b.index - a.index;
  });
};

// Compare values between entries
const compareValues = (entries: TCPDataEntry[]): TCPComparison[] => {
  if (entries.length < 2) return [];

  const comparisons: TCPComparison[] = [];

  for (let i = 0; i < Math.min(entries.length - 1, 5); i++) {
    const current = entries[i];
    const previous = entries[i + 1];

    if (current.elementNumber === previous.elementNumber) {
      const newVal = parseFloat(current.elementValue) || 0;
      const oldVal = parseFloat(previous.elementValue) || 0;
      const change = newVal - oldVal;
      const changePercent = oldVal !== 0 ? (change / Math.abs(oldVal)) * 100 : 0;

      comparisons.push({
        toolNumber: current.parsedElement.actualToolNumber,
        parameterName: current.parsedElement.parameterName,
        parameterGroupName: current.parsedElement.parameterGroupName,
        elementNumber: current.elementNumber,
        oldValue: oldVal,
        newValue: newVal,
        change,
        changePercent,
      });
    }
  }

  return comparisons;
};

// Calculate statistics
const calculateStatistics = (events: TCPDataEntry[]): TCPStatistics => {
  const uniqueToolsSet = new Set<string>();
  const changesByParameter: Record<string, number> = {};

  events.forEach((event) => {
    uniqueToolsSet.add(`TOOL ${event.parsedElement.actualToolNumber}`);
    const paramKey = event.parsedElement.parameterName;
    changesByParameter[paramKey] = (changesByParameter[paramKey] || 0) + 1;
  });

  return {
    totalTCPChanges: events.length,
    toolsModified: uniqueToolsSet.size,
    uniqueTools: Array.from(uniqueToolsSet),
    lastChangeDate: events.length > 0 ? events[0].date : undefined,
    changesByParameter,
  };
};

// Get TCP logs for a single controller
export const getTcpLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    // Handle "all" - aggregate all controllers
    if (controllerId === "all") {
      return await handleAllControllersTCP(req, res);
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
        comparisons: [],
        statistics: null,
      });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const stats = fs.statSync(filePath);

    const logEntries = parseLogContent(fileContent);
    const tcpEvents = extractTCPDataEvents(logEntries, controllerId, controllerName);
    const comparisons = compareValues(tcpEvents);
    const statistics = calculateStatistics(tcpEvents);

    // Save to database
    let savedToDb = false;
    let newEventsCount = 0;
    try {
      const saveResult = await saveTCPEvents({
        controllerId,
        events: tcpEvents as ServiceTCPEvent[],
        fileModifiedAt: stats.mtime,
      });
      savedToDb = true;
      newEventsCount = saveResult.newEventsCount;
      //console.log(`TCP events saved to DB for ${controllerName}: ${saveResult.eventsCount} total, ${newEventsCount} new`);
    } catch (dbError) {
      console.error("Error saving TCP events to DB:", dbError);
    }

    const response: TCPLogsResponse = {
      success: true,
      events: tcpEvents,
      comparisons,
      statistics,
      controllerId,
      controllerName,
      lastModified: stats.mtime.toISOString(),
      savedToDb,
      newEventsCount,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching TCP logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

// Handle all controllers aggregation
const handleAllControllersTCP = async (req: Request, res: Response) => {
  try {
    const controllersQuery = `SELECT id, ip_address, name FROM controller ORDER BY name`;
    const controllersResult = await dbPool.query(controllersQuery);

    if (controllersResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No controllers found in the system",
        events: [],
        comparisons: [],
        statistics: null,
      });
    }

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const fileName = "LOGDATA.DAT";
    let allTCPEvents: TCPDataEntry[] = [];
    let lastModifiedDate: Date | null = null;
    let processedCount = 0;

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
          const tcpEvents = extractTCPDataEvents(logEntries, controller.id, controller.name);
          allTCPEvents = allTCPEvents.concat(tcpEvents);
          processedCount++;

          // Save to database for each controller
          try {
            const saveResult = await saveTCPEvents({
              controllerId: controller.id,
              events: tcpEvents as ServiceTCPEvent[],
              fileModifiedAt: stats.mtime,
            });
            //console.log(`TCP events saved to DB for ${controller.name}: ${saveResult.eventsCount} total, ${saveResult.newEventsCount} new`);
          } catch (dbError) {
            console.error(`Error saving TCP events to DB for ${controller.name}:`, dbError);
          }
        } catch (error) {
          console.error(`Error reading log for controller ${controller.name}:`, error);
        }
      }
    }

    // Sort by date
    allTCPEvents.sort((a, b) => {
      if (a.date && b.date) {
        const dateA = new Date(a.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
        const dateB = new Date(b.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
        return dateB.getTime() - dateA.getTime();
      }
      return b.index - a.index;
    });

    const comparisons = compareValues(allTCPEvents);
    const statistics = calculateStatistics(allTCPEvents);

    const response: TCPLogsResponse = {
      success: true,
      events: allTCPEvents,
      comparisons,
      statistics,
      lastModified: lastModifiedDate?.toISOString() || new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating TCP logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate TCP logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

// Get TCP events from database
export const getTcpEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, toolNumber, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const result = await getTCPEventsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
      toolNumber: toolNumber ? parseInt(toolNumber as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      events: result.events,
      total: result.total,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
  } catch (error) {
    console.error("Error fetching TCP events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Get TCP history/statistics from database
export const getTcpHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const stats = await getDailyTCPStatisticsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as "day" | "week" | "month",
    });

    return res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error fetching TCP history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Get all controllers TCP summary from database
export const getAllControllersTcpSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await getAllControllersTCPSummary();

    return res.status(200).json({
      success: true,
      controllers: summary,
    });
  } catch (error) {
    console.error("Error fetching TCP summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Check if controller has TCP data in database
export const checkTcpData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await hasTCPData(controllerId);

    return res.status(200).json({
      success: true,
      hasData,
    });
  } catch (error) {
    console.error("Error checking TCP data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check TCP data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
