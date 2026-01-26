import { ReportData } from "../../models/report-data";
import { generatePDF } from "./pdf-generator";
import { generateExcel } from "./excel-generator";
import { generateCSV } from "./csv-generator";
import path from "path";
import fs from "fs";
import os from "os";

const REPORTS_DIR = os.tmpdir();

function createReportFilename(reportName: string, format: string): string {
  const now = new Date();

  const cleanName = reportName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();

  const dateStr = now.toISOString().split("T")[0];

  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  const baseFilename = `${cleanName}_${dateStr}_${timeStr}`;

  return baseFilename;
}

export async function generateReportFile(reportData: ReportData, format: string, reportId: string): Promise<string> {
  const baseFilename = createReportFilename(reportData.metadata.report_name, format);

  let filePath: string;
  let fileExtension: string;

  switch (format.toLowerCase()) {
    case "pdf":
      fileExtension = ".pdf";
      filePath = path.join(REPORTS_DIR, `${baseFilename}${fileExtension}`);
      await generatePDF(reportData, filePath);
      break;

    case "excel":
      fileExtension = ".xlsx";
      filePath = path.join(REPORTS_DIR, `${baseFilename}${fileExtension}`);
      await generateExcel(reportData, filePath);
      break;

    case "csv":
      fileExtension = ".csv";
      filePath = path.join(REPORTS_DIR, `${baseFilename}${fileExtension}`);
      await generateCSV(reportData, filePath);
      break;

    case "json":
      fileExtension = ".json";
      filePath = path.join(REPORTS_DIR, `${baseFilename}${fileExtension}`);
      try {
        const jsonString = JSON.stringify(reportData, null, 2);
        fs.writeFileSync(filePath, jsonString);
      } catch (jsonError) {
        console.error("JSON stringify error:", jsonError);
        throw new Error(`Failed to serialize report data: ${jsonError}`);
      }
      break;

    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  return filePath;
}

export function cleanupOldReports(maxAgeHours: number = 168) {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return;
    }

    const files = fs.readdirSync(REPORTS_DIR);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(REPORTS_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error("Error cleaning up old reports:", error);
  }
}

export function getReportFileInfo(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.mtime,
      exists: true,
    };
  } catch (error) {
    return null;
  }
}
