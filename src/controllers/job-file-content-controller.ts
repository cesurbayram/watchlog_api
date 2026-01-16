import { Request, Response } from "express";
import { dbPool } from "../config/db";
import fs from "fs";
import path from "path";
import os from "os";

const getJobFileContent = async (req: Request, res: Response) => {
  try {
    const { controllerId, jobName } = req.params;

    if (!controllerId || !jobName) {
      return res.status(400).json({
        success: false,
        error: "Controller ID and job name are required",
      });
    }

    const controllerQuery = `SELECT ip_address FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const ipAddress = controllerResult.rows[0].ip_address;

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const folderName = `${ipAddress}_${jobName}`;
    const fileName = `${jobName}.JBI`;
    const filePath = path.join(baseDir, folderName, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({
        success: false,
        error: "Job file not found. Please make sure the file has been downloaded.",
        filePath,
      });
    }

    const stats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    return res.status(200).json({
      success: true,
      content: fileContent,
      fileName: fileName,
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
      filePath,
    });
  } catch (error) {
    console.error("Error reading job file:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to read job file: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export { getJobFileContent };
