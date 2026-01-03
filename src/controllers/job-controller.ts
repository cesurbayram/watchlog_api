import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";

const getJobs = async (req: Request, res: Response) => {
  const { controllerId } = req.query;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    const jobDbResp = await dbPool.query(
      `SELECT 
        id, 
        name,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM job_select
      WHERE controller_id = $1
      ORDER BY name ASC`,
      [controllerId],
    );

    return res.status(200).json(jobDbResp.rows);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);

    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

const getJobFileContent = async (req: Request, res: Response) => {
  const { controllerId, jobName } = req.params;

  if (!controllerId || !jobName) {
    return res.status(400).json({ success: false, error: "Controller ID and job name are required" });
  }

  try {
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
      return res.status(400).json({
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

const getJobById = async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const jobDbResp = await dbPool.query(
      `
      SELECT 
        id, 
        name,
        created_at,
        updated_at
      FROM job_select
      WHERE id = $1
    `,
      [jobId],
    );

    if (jobDbResp.rows.length === 0) {
      return res.status(404).json({ error: "Job select not found" });
    }

    return res.status(200).json(jobDbResp.rows[0]);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ error: "Failed to fetch job select" });
  }
};

export { getJobFileContent, getJobs, getJobById };
