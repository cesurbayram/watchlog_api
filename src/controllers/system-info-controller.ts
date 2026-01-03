import { Request, Response } from "express";
import { dbPool } from "../config/db";
import fs from "fs";
import path from "path";
import os from "os";

const getSystemInfoByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    const controllerQuery = `SELECT ip_address FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (!controllerResult || controllerResult.rows.length === 0) {
      return res.status(404).json({ error: "Controller not found" });
    }

    const ipAddress = controllerResult.rows[0].ip_address;

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const systemInfoDir = path.join(baseDir, `${ipAddress}_SYSTEM`);

    if (!fs.existsSync(systemInfoDir)) {
      return res.status(200).json({
        content: null,
        message: "No system files found",
      });
    }

    const files = fs.readdirSync(systemInfoDir);
    const systemFiles = files.filter((file) => file.toUpperCase().includes("SYSTEM") && (file.endsWith(".SYS") || file.endsWith(".sys")));

    if (systemFiles.length === 0) {
      return res.status(200).json({
        content: null,
        message: "No SYSTEM.SYS files found",
      });
    }

    const latestFile = systemFiles
      .map((fileName) => {
        const filePath = path.join(systemInfoDir, fileName);
        const stats = fs.statSync(filePath);
        return { fileName, filePath, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

    const content = fs.readFileSync(latestFile.filePath, "utf8");

    return res.status(200).json({
      content,
      fileName: latestFile.fileName,
      lastModified: latestFile.mtime,
      message: "File read successfully",
    });
  } catch (error) {
    console.error("Error reading system info file:", error);
    return res.status(500).json({ error: "Internal server error", content: null });
  }
};

export { getSystemInfoByControllerId };
