import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import { LogEntry } from "../models/log-content";
import { parseLogContent } from "../utils/cmos-backup";
import {
  saveAbsoEvents,
  getAbsoEventsFromDB,
  getDailyAbsoStatisticsFromDB,
  getAllControllersAbsoSummary,
  hasAbsoData,
  AbsoEvent as ServiceAbsoEvent,
} from "../services/abso-event-service";

interface R1Values {
  S?: number;
  L?: number;
  U?: number;
  R?: number;
  B?: number;
  T?: number;
}

interface AbsoluteDataEntry {
  index: number;
  date: string;
  groupNumber: string;
  axisNumber: string;
  setValue: string;
  currValue: { R1: R1Values };
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

interface AxisComparison {
  axis: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

interface AbsoStatistics {
  totalAbsoEvents: number;
  axisChanges: number;
  changedAxes: string[];
  lastChangeDate?: string;
  changesByAxis: Record<string, number>;
}

interface AbsoLogsResponse {
  success: boolean;
  events: AbsoluteDataEntry[];
  comparisons: AxisComparison[];
  statistics: AbsoStatistics | null;
  error?: string;
  controllerId?: string;
  controllerName?: string;
  lastModified?: string;
  savedToDb?: boolean;
  newEventsCount?: number;
}

const parseCurrentValue = (currValueText: string): { R1: R1Values } => {
  const values: { R1: R1Values } = { R1: {} };

  if (!currValueText || currValueText.trim() === "") {
    return values;
  }

  const lines = currValueText.split("\n");
  let inCurrValueSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "CURR VALUE") {
      inCurrValueSection = true;
      continue;
    }

    if (inCurrValueSection) {
      if (trimmed.includes("R1 :S")) {
        const match = trimmed.match(/R1\s*:S\s+(-?\d+)/);
        if (match) {
          values.R1.S = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*L\s+(-?\d+)/)) {
        const match = trimmed.match(/L\s+(-?\d+)/);
        if (match) {
          values.R1.L = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*U\s+(-?\d+)/)) {
        const match = trimmed.match(/U\s+(-?\d+)/);
        if (match) {
          values.R1.U = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*R\s+(-?\d+)/) && !trimmed.includes("R1")) {
        const match = trimmed.match(/R\s+(-?\d+)/);
        if (match) {
          values.R1.R = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*B\s+(-?\d+)/)) {
        const match = trimmed.match(/B\s+(-?\d+)/);
        if (match) {
          values.R1.B = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*T\s+(-?\d+)/)) {
        const match = trimmed.match(/T\s+(-?\d+)/);
        if (match) {
          values.R1.T = parseInt(match[1]);
        }
      } else if (trimmed.startsWith("///INDEX")) {
        break;
      }
    }
  }

  return values;
};

const extractAbsoluteDataEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): AbsoluteDataEntry[] => {
  const events: AbsoluteDataEntry[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    if (event.includes("org abso")) {
      const currValueText = entry.fields["CURR VALUE"] || entry.rawData || "";
      const parsedValues = parseCurrentValue(currValueText);

      events.push({
        index: entry.index,
        date: entry.date || "",
        groupNumber: entry.fields["GROUP NUMBER"] || "",
        axisNumber: entry.fields["AXIS NUMBER"] || "",
        setValue: entry.fields["SET VALUE"] || "",
        currValue: parsedValues,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
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

const compareValues = (entries: AbsoluteDataEntry[]): AxisComparison[] => {
  if (entries.length < 2) return [];

  const latest = entries[0];
  const previous = entries[1];

  const comparisons: AxisComparison[] = [];
  const axes: (keyof R1Values)[] = ["S", "L", "U", "R", "B", "T"];

  axes.forEach((axis) => {
    const newVal = latest.currValue.R1[axis] || 0;
    const oldVal = previous.currValue.R1[axis] || 0;

    const change = newVal - oldVal;
    const changePercent = oldVal !== 0 ? (change / Math.abs(oldVal)) * 100 : 0;

    comparisons.push({
      axis,
      oldValue: oldVal,
      newValue: newVal,
      change,
      changePercent,
    });
  });

  return comparisons;
};

const calculateStatistics = (events: AbsoluteDataEntry[]): AbsoStatistics => {
  const changesByAxis: Record<string, number> = {};
  const changedAxesSet = new Set<string>();

  events.forEach((event) => {
    const r1 = event.currValue.R1;
    if (r1.S !== undefined) {
      changesByAxis["S"] = (changesByAxis["S"] || 0) + 1;
      changedAxesSet.add("S");
    }
    if (r1.L !== undefined) {
      changesByAxis["L"] = (changesByAxis["L"] || 0) + 1;
      changedAxesSet.add("L");
    }
    if (r1.U !== undefined) {
      changesByAxis["U"] = (changesByAxis["U"] || 0) + 1;
      changedAxesSet.add("U");
    }
    if (r1.R !== undefined) {
      changesByAxis["R"] = (changesByAxis["R"] || 0) + 1;
      changedAxesSet.add("R");
    }
    if (r1.B !== undefined) {
      changesByAxis["B"] = (changesByAxis["B"] || 0) + 1;
      changedAxesSet.add("B");
    }
    if (r1.T !== undefined) {
      changesByAxis["T"] = (changesByAxis["T"] || 0) + 1;
      changedAxesSet.add("T");
    }
  });

  return {
    totalAbsoEvents: events.length,
    axisChanges: Object.values(changesByAxis).reduce((a, b) => a + b, 0),
    changedAxes: Array.from(changedAxesSet),
    lastChangeDate: events.length > 0 ? events[0].date : undefined,
    changesByAxis,
  };
};

export const getAbsoLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersAbso(req, res);
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
    const absoEvents = extractAbsoluteDataEvents(logEntries, controllerId, controllerName);
    const comparisons = compareValues(absoEvents);
    const statistics = calculateStatistics(absoEvents);

    // Save to database
    let savedToDb = false;
    let newEventsCount = 0;
    try {
      const saveResult = await saveAbsoEvents({
        controllerId,
        events: absoEvents as ServiceAbsoEvent[],
        fileModifiedAt: stats.mtime,
      });
      savedToDb = true;
      newEventsCount = saveResult.newEventsCount;
      //console.log(`ABSO events saved to DB for ${controllerName}: ${saveResult.eventsCount} total, ${newEventsCount} new`);
    } catch (dbError) {
      console.error("Error saving ABSO events to DB:", dbError);
    }

    const response: AbsoLogsResponse = {
      success: true,
      events: absoEvents,
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
    console.error("Error fetching ABSO logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

// Handle all controllers aggregation
const handleAllControllersAbso = async (req: Request, res: Response) => {
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
    let allAbsoEvents: AbsoluteDataEntry[] = [];
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
          const absoEvents = extractAbsoluteDataEvents(logEntries, controller.id, controller.name);
          allAbsoEvents = allAbsoEvents.concat(absoEvents);
          processedCount++;

          // Save to database for each controller
          try {
            const saveResult = await saveAbsoEvents({
              controllerId: controller.id,
              events: absoEvents as ServiceAbsoEvent[],
              fileModifiedAt: stats.mtime,
            });
            //console.log(`ABSO events saved to DB for ${controller.name}: ${saveResult.eventsCount} total, ${saveResult.newEventsCount} new`);
          } catch (dbError) {
            console.error(`Error saving ABSO events to DB for ${controller.name}:`, dbError);
          }
        } catch (error) {
          console.error(`Error reading log for controller ${controller.name}:`, error);
        }
      }
    }

    // Sort by date
    allAbsoEvents.sort((a, b) => {
      if (a.date && b.date) {
        const dateA = new Date(a.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
        const dateB = new Date(b.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
        return dateB.getTime() - dateA.getTime();
      }
      return b.index - a.index;
    });

    const comparisons = compareValues(allAbsoEvents);
    const statistics = calculateStatistics(allAbsoEvents);

    const response: AbsoLogsResponse = {
      success: true,
      events: allAbsoEvents,
      comparisons,
      statistics,
      lastModified: lastModifiedDate?.toISOString() || new Date().toISOString(),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating ABSO logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate ABSO logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

// Get ABSO events from database
export const getAbsoEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const result = await getAbsoEventsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
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
    console.error("Error fetching ABSO events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Get ABSO history/statistics from database
export const getAbsoHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const stats = await getDailyAbsoStatisticsFromDB(controllerId, {
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as "day" | "week" | "month",
    });

    return res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error fetching ABSO history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Get all controllers ABSO summary from database
export const getAllControllersAbsoSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await getAllControllersAbsoSummary();

    return res.status(200).json({
      success: true,
      controllers: summary,
    });
  } catch (error) {
    console.error("Error fetching ABSO summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

// Check if controller has ABSO data in database
export const checkAbsoData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await hasAbsoData(controllerId);

    return res.status(200).json({
      success: true,
      hasData,
    });
  } catch (error) {
    console.error("Error checking ABSO data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check ABSO data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
