import { dbPool } from "../../config/db.js";
import { parseSystemFile } from "../parse-system-file.js";
import fs from "fs";
import path from "path";
import os from "os";
import { OperatingRateReportData, ControllerOperatingData, LogEntry } from "../../models/operating-rate-dto";

export async function collectOperatingRateReportData(
  controllerIds?: string[],
  timeRange: "24h" | "7d" | "shift" = "7d",
  shiftId?: string,
): Promise<OperatingRateReportData> {
  const client = await dbPool.connect();

  try {
    const daysToFetch = timeRange === "24h" ? 1 : timeRange === "shift" ? 1 : 7;

    const controllersQuery =
      controllerIds && controllerIds.length > 0
        ? `
          SELECT 
            c.id, 
            c.name, 
            c.ip_address,
            c.model,
            c.application,
            c.serial_number,
            c.location,
            c.status
          FROM controller c
          WHERE c.id = ANY($1)
          ORDER BY c.ip_address
        `
        : `
          SELECT 
            c.id, 
            c.name, 
            c.ip_address,
            c.model,
            c.application,
            c.serial_number,
            c.location,
            c.status
          FROM controller c
          ORDER BY c.ip_address
        `;

    const controllersResult =
      controllerIds && controllerIds.length > 0 ? await client.query(controllersQuery, [controllerIds]) : await client.query(controllersQuery);
    const controllers = controllersResult.rows;

    const shiftsQuery = await client.query(`
      SELECT id, name, shift_start, shift_end
      FROM shift
      ORDER BY shift_start
    `);
    const shifts = shiftsQuery.rows;

    if (controllers.length === 0) {
      throw new Error("No controllers found");
    }

    const controllerData: ControllerOperatingData[] = [];

    for (const controller of controllers) {
      const logEntries = await readLogDataFile(controller.ip_address);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToFetch);

      const filteredLogEntries = logEntries.filter((log) => {
        if (!log.date) return false;
        try {
          const logDate = new Date(log.date);
          return logDate >= cutoffDate;
        } catch {
          return false;
        }
      });

      const first10Entries = filteredLogEntries.slice(0, 10);

      let lineName = "N/A";
      let cellName = "N/A";
      let factoryName = "N/A";

      if (controller.location) {
        const locationParts = controller.location.split("/");
        if (locationParts.length >= 3) {
          factoryName = locationParts[0] || "N/A";
          lineName = locationParts[1] || "N/A";
          cellName = locationParts[2] || "N/A";
        }
      }

      const systemInfo = await readSystemInfo(controller.ip_address);

      controllerData.push({
        id: controller.id,
        name: controller.name,
        ip_address: controller.ip_address,
        model: controller.model || systemInfo.robotModel || "N/A",
        application: controller.application || systemInfo.application || "N/A",
        serial_number: controller.serial_number || "N/A",
        version: systemInfo.version || "N/A",
        system_no: systemInfo.systemNo || "N/A",
        language: systemInfo.language || "N/A",
        param_no: systemInfo.paramNo || "N/A",
        manipulator_type: systemInfo.manipulatorType || "N/A",
        factory: factoryName,
        line: lineName,
        cell: cellName,
        status: controller.status || "N/A",
        operating_analysis: {
          total_log_entries: filteredLogEntries.length,
          operating_rate_percentage: 0,
          daily_breakdown: [],
          system_states: {
            teach_mode: { count: 0, percentage: 0, average_duration_minutes: 0 },
            play_mode: { count: 0, percentage: 0, average_duration_minutes: 0 },
            error_state: { count: 0, percentage: 0, most_common_errors: [] },
            idle_state: { count: 0, percentage: 0 },
          },
          critical_events: {
            total_count: 0,
            events_per_day: 0,
            top_critical_events: [],
            recent_critical_events: [],
          },
          performance_trend: 0,
        },
        first_5_logs: first10Entries,
      });
    }

    const summary = {
      overall_operating_rate: 0,
      total_log_entries: controllerData.reduce((sum, c) => sum + c.operating_analysis.total_log_entries, 0),
      total_critical_events: 0,
      most_efficient_controller: "N/A",
      least_efficient_controller: "N/A",
      average_daily_operating_rate: 0,
    };

    const periodText = timeRange === "24h" ? "Last 24 Hours" : timeRange === "shift" ? "Current Shift" : "Last 7 Days";

    return {
      metadata: {
        title: "Robot Log Data Analysis",
        generated_at: new Date().toISOString(),
        period: periodText,
        total_controllers: controllers.length,
        shifts: shifts.map((shift: any) => ({
          name: shift.name,
          start: shift.shift_start,
          end: shift.shift_end,
        })),
      },
      controllers: controllerData,
      summary,
    };
  } catch (error) {
    return {
      metadata: {
        title: "Robot Log Data Analysis",
        generated_at: new Date().toISOString(),
        period: "Last 10 Logs",
        total_controllers: 0,
        shifts: [],
      },
      controllers: [],
      summary: {
        overall_operating_rate: 0,
        total_log_entries: 0,
        total_critical_events: 0,
        most_efficient_controller: "N/A",
        least_efficient_controller: "N/A",
        average_daily_operating_rate: 0,
      },
    };
  } finally {
    client.release();
  }
}

async function readSystemInfo(ipAddress: string): Promise<{
  version?: string;
  systemNo?: string;
  robotModel?: string;
  application?: string;
  language?: string;
  paramNo?: string;
  manipulatorType?: string;
}> {
  try {
    const folderName = `${ipAddress}_SYSTEM`;

    const baseDir =
      process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? path.join("C:", "Watchlog", "UI") : path.join(os.homedir(), "Watchlog", "UI"));

    const systemInfoDir = path.join(baseDir, folderName);

    if (!fs.existsSync(systemInfoDir)) {
      return {};
    }

    const files = fs.readdirSync(systemInfoDir);
    const systemFiles = files.filter((file) => file.toUpperCase().includes("SYSTEM") && (file.endsWith(".SYS") || file.endsWith(".sys")));

    if (systemFiles.length === 0) {
      return {};
    }

    const latestFile = systemFiles
      .map((fileName) => {
        const filePath = path.join(systemInfoDir, fileName);
        const stats = fs.statSync(filePath);
        return { fileName, filePath, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

    const content = fs.readFileSync(latestFile.filePath, "utf8");
    const parsedInfo = parseSystemFile(content);

    const manipulatorType = parsedInfo.robots.length > 0 ? `${parsedInfo.robots[0].name} - ${parsedInfo.robots[0].model}` : undefined;

    let languageCode = "N/A";
    if (parsedInfo.systemNo) {
      const langMatch = parsedInfo.systemNo.match(/\(([A-Z\/]+)\)/);
      if (langMatch) {
        languageCode = langMatch[1];
      }
    }

    return {
      version: parsedInfo.version,
      systemNo: parsedInfo.systemNo,
      robotModel: parsedInfo.robotModel,
      application: parsedInfo.application,
      language: languageCode,
      paramNo: parsedInfo.paramNo,
      manipulatorType: manipulatorType,
    };
  } catch (error) {
    console.error(`Error reading system info for ${ipAddress}:`, error);
    return {};
  }
}

async function readLogDataFile(ipAddress: string): Promise<LogEntry[]> {
  try {
    const fileName = "LOGDATA.DAT";
    const folderName = `${ipAddress}_LOGDATA`;

    const baseDir =
      process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? path.join("C:", "Watchlog", "UI") : path.join(os.homedir(), "Watchlog", "UI"));

    const filePath = path.join(baseDir, folderName, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`Log file not found at: ${filePath}`);
      return [];
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    return parseLogContent(fileContent);
  } catch (error) {
    console.error("Error reading log file:", error);
    return [];
  }
}

function parseLogContent(content: string): LogEntry[] {
  const entries: LogEntry[] = [];

  const lines = content.split("\n");
  let currentEntry: Partial<LogEntry> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    if (trimmedLine.startsWith("///INDEX")) {
      if (currentEntry.index !== undefined) {
        entries.push({
          index: currentEntry.index,
          date: currentEntry.date,
          event: currentEntry.event,
          loginName: currentEntry.loginName,
          fields: currentEntry.fields || {},
          rawData: currentEntry.rawData || "",
        });
      }

      const indexMatch = trimmedLine.match(/\/\/\/INDEX\s+(\d+)/);
      if (indexMatch) {
        currentEntry = {
          index: parseInt(indexMatch[1], 10),
          fields: {},
          rawData: trimmedLine,
        };
      }
    } else if (trimmedLine.includes("DATE") && trimmedLine.includes(":")) {
      const colonIndex = trimmedLine.indexOf(":");
      currentEntry.date = trimmedLine.substring(colonIndex + 1).trim();
      if (currentEntry.rawData) {
        currentEntry.rawData += "\n" + trimmedLine;
      }
    } else if (trimmedLine.includes("EVENT") && trimmedLine.includes(":") && !trimmedLine.includes("CRITICAL")) {
      const colonIndex = trimmedLine.indexOf(":");
      currentEntry.event = trimmedLine.substring(colonIndex + 1).trim();
      if (currentEntry.rawData) {
        currentEntry.rawData += "\n" + trimmedLine;
      }
    } else if (trimmedLine.includes("LOGIN NAME") && trimmedLine.includes(":")) {
      const colonIndex = trimmedLine.indexOf(":");
      currentEntry.loginName = trimmedLine.substring(colonIndex + 1).trim();
      if (currentEntry.rawData) {
        currentEntry.rawData += "\n" + trimmedLine;
      }
    } else if (currentEntry.index !== undefined) {
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex > 0 && currentEntry.fields) {
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();
        currentEntry.fields[key] = value;
      }

      if (currentEntry.rawData) {
        currentEntry.rawData += "\n" + trimmedLine;
      }
    }
  }

  if (currentEntry.index !== undefined) {
    entries.push({
      index: currentEntry.index,
      date: currentEntry.date,
      event: currentEntry.event,
      loginName: currentEntry.loginName,
      fields: currentEntry.fields || {},
      rawData: currentEntry.rawData || "",
    });
  }

  return entries;
}
