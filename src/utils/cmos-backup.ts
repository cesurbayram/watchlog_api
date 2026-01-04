import { Response, response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import { LogEntry, LogFileContentResponse } from "../models/log-content";

export function parseLogContent(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = content.split("\n");

  let currentEntry: Partial<LogEntry> = {};
  let entryLines: string[] = [];
  let isMultiLineValue = false;
  let multiLineKey = "";
  let multiLineContent: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("///INDEX")) {
      if (currentEntry.index !== undefined) {
        if (isMultiLineValue && multiLineContent.length > 0) {
          currentEntry.fields![multiLineKey] = multiLineContent.join("\n");
        }

        entries.push({
          index: currentEntry.index,
          date: currentEntry.date,
          event: currentEntry.event,
          loginName: currentEntry.loginName,
          fields: currentEntry.fields || {},
          rawData: entryLines.join("\n"),
        });

        if (entries.length >= 600) {
          break;
        }
      }

      currentEntry = { fields: {} };
      entryLines = [line];
      isMultiLineValue = false;
      multiLineContent = [];

      const indexMatch = trimmedLine.match(/\/\/\/INDEX\s+(\d+)/);
      if (indexMatch) {
        currentEntry.index = parseInt(indexMatch[1]);
      }
    } else if (trimmedLine.includes(":") && !isMultiLineValue) {
      const colonIndex = trimmedLine.indexOf(":");
      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      if (key === "DATE") {
        currentEntry.date = value;
      } else if (key === "EVENT") {
        currentEntry.event = value;
      } else if (key === "LOGIN NAME") {
        currentEntry.loginName = value;
      } else if (key === "CURR VALUE") {
        isMultiLineValue = true;
        multiLineKey = key;
        multiLineContent = [value];
      } else {
        currentEntry.fields![key] = value;
      }
      entryLines.push(line);
    } else if (isMultiLineValue) {
      if (trimmedLine.length > 0 && !trimmedLine.startsWith("///")) {
        multiLineContent.push(trimmedLine);
      } else if (trimmedLine.length === 0) {
        currentEntry.fields![multiLineKey] = multiLineContent.join("\n");
        isMultiLineValue = false;
        multiLineContent = [];
      }
      entryLines.push(line);
    } else if (trimmedLine.length > 0) {
      entryLines.push(line);
    }
  }

  if (currentEntry.index !== undefined) {
    if (isMultiLineValue && multiLineContent.length > 0) {
      currentEntry.fields![multiLineKey] = multiLineContent.join("\n");
    }

    entries.push({
      index: currentEntry.index,
      date: currentEntry.date,
      event: currentEntry.event,
      loginName: currentEntry.loginName,
      fields: currentEntry.fields || {},
      rawData: entryLines.join("\n"),
    });
  }

  return entries;
}

export async function handleAllControllers(): Promise<Response<LogFileContentResponse>> {
  try {
    // Fetch all controllers
    const controllersQuery = `SELECT id, ip_address, name FROM controller ORDER BY name`;
    const controllersResult = await dbPool.query(controllersQuery);

    if (controllersResult.rows.length === 0) {
      return response.json({
        success: false,
        error: "No controllers found in the system",
      });
    }

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const fileName = "LOGDATA.DAT";
    let allLogEntries: LogEntry[] = [];
    let lastModifiedDate: Date | null = null;
    let processedCount = 0;
    let skippedControllers: string[] = [];

    // Read and parse each controller's LOGDATA.DAT
    for (const controller of controllersResult.rows) {
      const folderName = `${controller.ip_address}_LOGDATA`;
      const filePath = path.join(baseDir, folderName, fileName);

      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const stats = fs.statSync(filePath);

          // Track most recent modification
          if (!lastModifiedDate || stats.mtime > lastModifiedDate) {
            lastModifiedDate = stats.mtime;
          }

          const logEntries = parseLogContent(fileContent);

          // Add controller info to each entry for identification
          const entriesWithController = logEntries.map((entry) => ({
            ...entry,
            controllerId: controller.id,
            controllerName: controller.name,
            controllerIp: controller.ip_address,
          }));

          allLogEntries = allLogEntries.concat(entriesWithController);
          processedCount++;
        } catch (error) {
          console.error(`Error reading log for controller ${controller.name}:`, error);
          skippedControllers.push(controller.name);
        }
      } else {
        skippedControllers.push(controller.name);
      }
    }

    // Sort all entries by index (descending - newest first)
    allLogEntries.sort((a, b) => b.index - a.index);

    console.log(`Aggregate log data: ${processedCount} controllers processed, ${allLogEntries.length} total entries`);
    if (skippedControllers.length > 0) {
      console.log(`Skipped controllers (no log file): ${skippedControllers.join(", ")}`);
    }

    return response.json({
      success: true,
      data: allLogEntries,
      filePath: `Aggregated from ${processedCount} controllers`,
      lastModified: lastModifiedDate?.toISOString() || new Date().toISOString(),
      metadata: {
        totalControllers: controllersResult.rows.length,
        processedControllers: processedCount,
        skippedControllers: skippedControllers,
        totalEntries: allLogEntries.length,
      },
    });
  } catch (error) {
    console.error("Error aggregating log data:", error);
    return response.status(500).json({
      success: false,
      error: `Failed to aggregate log data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
