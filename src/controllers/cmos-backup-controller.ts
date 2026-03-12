import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import archiver from "archiver";
import { handleAllControllers, parseLogContent } from "../utils/cmos-backup";

function parseFolderNameToDate(folderName: string): string | null {
  const match = folderName.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}


function resolveBackupFolder(
  backupBaseDir: string,
  controllerIp: string,
  controllerName: string | null,
  sessionTime: Date,
  expectedFileNames?: string[]
): { folderPath: string; folderName: string } | null {
  const year = sessionTime.getFullYear();
  const month = String(sessionTime.getMonth() + 1).padStart(2, "0");
  const day = String(sessionTime.getDate()).padStart(2, "0");
  const hour = String(sessionTime.getHours()).padStart(2, "0");
  const minute = String(sessionTime.getMinutes()).padStart(2, "0");
  const hourUtc = String(sessionTime.getUTCHours()).padStart(2, "0");
  const minuteUtc = String(sessionTime.getUTCMinutes()).padStart(2, "0");

  const possibleFolderNames = [
    ...(controllerName ? [`${controllerName}_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`] : []),
    `or_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
    `or1_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
    `or2_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
    ...(controllerName ? [`${controllerName}_${controllerIp}_${year}-${month}-${day}_${hourUtc}_${minuteUtc}`] : []),
    `or_${controllerIp}_${year}-${month}-${day}_${hourUtc}_${minuteUtc}`,
    `or1_${controllerIp}_${year}-${month}-${day}_${hourUtc}_${minuteUtc}`,
    `or2_${controllerIp}_${year}-${month}-${day}_${hourUtc}_${minuteUtc}`,
    controllerIp,
  ];

  for (const folderName of possibleFolderNames) {
    const testPath = path.join(backupBaseDir, folderName);
    if (fs.existsSync(testPath) && fs.statSync(testPath).isDirectory()) {
      return { folderPath: testPath, folderName };
    }
  }

  if (expectedFileNames && expectedFileNames.length > 0 && fs.existsSync(backupBaseDir)) {
    const entries = fs.readdirSync(backupBaseDir, { withFileTypes: true });
    let bestMatch: { path: string; name: string; count: number } | null = null;

    for (const ent of entries) {
      if (!ent.isDirectory() || !ent.name.includes(controllerIp)) continue;
      const folderPath = path.join(backupBaseDir, ent.name);
      const filesInFolder = new Set(fs.readdirSync(folderPath));
      const matchCount = expectedFileNames.filter((f) => filesInFolder.has(f)).length;
      if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.count)) {
        bestMatch = { path: folderPath, name: ent.name, count: matchCount };
      }
    }
    if (bestMatch) {
      console.log(`Found backup folder via scan (${bestMatch.count} files): ${bestMatch.path}`);
      return { folderPath: bestMatch.path, folderName: bestMatch.name };
    }
  }

  return null;
}

const getBackupHistoryByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    let query: string;
    let queryParams: string[];

    if (controllerId === "all") {
      query = `
            SELECT 
              bs.id,
              bs.controller_id,
              bs.controller_ip,
              bs.session_start_time,
              bs.session_end_time,
              bs.total_files,
              bs.successful_files,
              bs.failed_files,
              bs.status,
              bs.created_at,
              bs.plan_id,
              bs.backup_type,
              bs.backup_folder_path,
              c.name as controller_name,
              bp.name as plan_name
            FROM backup_sessions bs
            LEFT JOIN controller c ON bs.controller_id = c.id
            LEFT JOIN backup_plans bp ON bs.plan_id = bp.id
            ORDER BY bs.session_start_time DESC
            LIMIT 100
          `;
      queryParams = [];
    } else {
      query = `
            SELECT 
              bs.id,
              bs.controller_id,
              bs.controller_ip,
              bs.session_start_time,
              bs.session_end_time,
              bs.total_files,
              bs.successful_files,
              bs.failed_files,
              bs.status,
              bs.created_at,
              bs.plan_id,
              bs.backup_type,
              bs.backup_folder_path,
              c.name as controller_name,
              bp.name as plan_name
            FROM backup_sessions bs
            LEFT JOIN controller c ON bs.controller_id = c.id
            LEFT JOIN backup_plans bp ON bs.plan_id = bp.id
            WHERE bs.controller_id = $1
            ORDER BY bs.session_start_time DESC
            LIMIT 50
          `;
      queryParams = [controllerId];
    }

    const result = await dbPool.query(query, queryParams);
    const rows = result.rows.map((row: { backup_folder_path?: string;[key: string]: unknown }) => {
      let backup_folder_time: string | null = null;
      if (row.backup_folder_path) {
        const folderName = path.basename(row.backup_folder_path);
        backup_folder_time = parseFolderNameToDate(folderName);
      }
      return { ...row, backup_folder_time };
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching backup history:", error);
    return res.status(500).json({ error: "Failed to fetch backup history" });
  }
};

const getBackupSessionBySessionId = async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const query = `
          SELECT 
            bfd.id,
            bfd.file_name,
            bfd.file_type,
            bfd.backup_status,
            bfd.backup_time,
            bfd.file_size_bytes,
            bfd.created_at
          FROM backup_file_details bfd
          WHERE bfd.session_id = $1
          ORDER BY bfd.backup_time ASC
        `;

    const result = await dbPool.query(query, [sessionId]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching backup session details:", error);
    return res.status(500).json({ error: "Failed to fetch backup session details" });
  }
};

const createZipBySessionId = async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
   
    let fileFilter: string[] | null = null;
    let categoryName: string | null = null;
    try {
      const body = req.body;
      if (body.files && Array.isArray(body.files)) {
        fileFilter = body.files;
      }
      if (body.category) {
        categoryName = body.category;
      }
    } catch {
     
    }

    const sessionQuery = `
          SELECT bs.*, c.ip_address, c.name as controller_name
          FROM backup_sessions bs
          JOIN controller c ON bs.controller_id = c.id
          WHERE bs.id = $1
        `;

    const sessionResult = await dbPool.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup session not found" });
    }

    const session = sessionResult.rows[0];
    const controllerIp = session.ip_address;
    const sessionTime = new Date(session.session_start_time);

    const filesQuery = `
          SELECT file_name, file_type, backup_status
          FROM backup_file_details
          WHERE session_id = $1 AND backup_status = true
          ORDER BY backup_time ASC
        `;

    const filesResult = await dbPool.query(filesQuery, [sessionId]);

    if (filesResult.rows.length === 0) {
      return res.status(404).json({ error: "No successful backup files found for this session" });
    }

    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    let controllerBackupDir: string | null = null;
    let backupFolderName: string | null = null;

    if (session.backup_folder_path && fs.existsSync(session.backup_folder_path)) {
      controllerBackupDir = session.backup_folder_path;
      backupFolderName = path.basename(session.backup_folder_path);
      console.log(`Using stored backup folder: ${controllerBackupDir}`);
    } else {
      const expectedFileNames = filesResult.rows.map((r: { file_name: string }) => r.file_name);
      const resolved = resolveBackupFolder(
        backupBaseDir,
        controllerIp,
        session.controller_name,
        sessionTime,
        expectedFileNames
      );
      if (resolved) {
        controllerBackupDir = resolved.folderPath;
        backupFolderName = resolved.folderName;
        console.log(`Found backup folder: ${controllerBackupDir}`);
        await dbPool.query(`UPDATE backup_sessions SET backup_folder_path = $1 WHERE id = $2`, [
          resolved.folderPath,
          sessionId,
        ]);
      }
    }

    if (!controllerBackupDir || !backupFolderName) {
      return res.status(404).json({
        error: "Backup directory not found",
        message: `Could not find backup folder for session ${sessionId}`,
        hint: "Make sure backup files have been created first",
      });
    }

    const tempDir = os.tmpdir();

    const zipFileName = categoryName ? `${backupFolderName}_${categoryName.replace(/[^a-zA-Z0-9]/g, "_")}.zip` : `${backupFolderName}.zip`;
    const zipFilePath = path.join(tempDir, zipFileName);


    if (!fileFilter && fs.existsSync(zipFilePath)) {
      const existingStats = fs.statSync(zipFilePath);
      return res.status(200).json({
        success: true,
        message: "ZIP file already exists",
        zipFileName,
        fileCount: filesResult.rows.length,
        zipSizeBytes: existingStats.size,
      });
    }


    const filesToZip = fileFilter ? filesResult.rows.filter((f: any) => fileFilter!.includes(f.file_name)) : filesResult.rows;

    let filesAdded = 0;
    let errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);

      archive.pipe(output);

      filesToZip.forEach((file: any) => {
        const sourceFilePath = path.join(controllerBackupDir as string, file.file_name);

        if (fs.existsSync(sourceFilePath)) {
          try {
            archive.file(sourceFilePath, { name: file.file_name });
            filesAdded++;
          } catch (error) {
            errors.push(`Failed to add ${file.file_name}: ${error}`);
          }
        } else {
          errors.push(`File not found: ${file.file_name}`);
        }
      });

      archive.finalize();
    });

    const stats = fs.statSync(zipFilePath);

    console.log(`ZIP created successfully: ${zipFilePath} (${stats.size} bytes)`);

    return res.status(200).json({
      success: true,
      message: categoryName ? `${categoryName} ZIP created successfully` : "ZIP file created successfully",
      zipFileName,
      fileCount: filesAdded,
      totalFiles: filesToZip.length,
      zipSizeBytes: stats.size,
      tempLocation: zipFilePath,
      category: categoryName,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error creating ZIP:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return res.status(500).json({
      error: "Failed to create ZIP file",
      message: errorMessage,
      hint: "Check if backup files exist and are accessible",
    });
  }
};

const downloadZipBySessionId = async (req: Request, res: Response) => {
  let zipFilePath: string | null = null;
  const { sessionId } = req.params;
  const { category } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const sessionQuery = `
      SELECT bs.*, c.ip_address, c.name as controller_name
      FROM backup_sessions bs
      JOIN controller c ON bs.controller_id = c.id
      WHERE bs.id = $1
    `;

    const sessionResult = await dbPool.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup session not found" });
    }

    const session = sessionResult.rows[0];
    const controllerIp = session.ip_address;
    const sessionTime = new Date(session.session_start_time);
    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    let folderName: string | null = null;
    if (session.backup_folder_path && fs.existsSync(session.backup_folder_path)) {
      folderName = path.basename(session.backup_folder_path);
    } else {
      const filesForResolve = await dbPool.query(
        `SELECT file_name FROM backup_file_details WHERE session_id = $1 AND backup_status = true`,
        [sessionId]
      );
      const expectedFileNames = filesForResolve.rows.map((r: { file_name: string }) => r.file_name);
      const resolved = resolveBackupFolder(
        backupBaseDir,
        controllerIp,
        session.controller_name,
        sessionTime,
        expectedFileNames
      );
      if (resolved) folderName = resolved.folderName;
    }

    const tempDir = os.tmpdir();
    const categorySuffix = category ? `_${(category as string).replace(/[^a-zA-Z0-9]/g, "_")}` : "";

    if (folderName) {
      if (category) {
        const categoryZipPath = path.join(tempDir, `${folderName}${categorySuffix}.zip`);
        if (fs.existsSync(categoryZipPath)) {
          zipFilePath = categoryZipPath;
          console.log(`Found category ZIP file: ${categoryZipPath}`);
        }
      }
      if (!zipFilePath) {
        const testZipPath = path.join(tempDir, `${folderName}.zip`);
        if (fs.existsSync(testZipPath)) {
          zipFilePath = testZipPath;
          console.log(`Found ZIP file: ${testZipPath}`);
        }
      }
    }

    if (!zipFilePath && fs.existsSync(tempDir)) {
      const zips = fs.readdirSync(tempDir).filter((f) => f.endsWith(".zip") && f.includes(controllerIp));
      if (zips.length > 0) {
        const match = category
          ? zips.find((f) => f.includes((category as string).replace(/[^a-zA-Z0-9]/g, "_")))
          : zips.sort(
            (a, b) =>
              fs.statSync(path.join(tempDir, b)).mtime.getTime() - fs.statSync(path.join(tempDir, a)).mtime.getTime()
          )[0];
        if (match) {
          zipFilePath = path.join(tempDir, match);
          console.log(`Found ZIP via scan: ${zipFilePath}`);
        }
      }
    }

    if (!zipFilePath) {
      return res.status(404).json({ error: "ZIP file not found. Please create ZIP first." });
    }

    if (!fs.existsSync(zipFilePath)) {
      return res.status(404).json({ error: "ZIP file not found" });
    }

    const stats = fs.statSync(zipFilePath);
    const fileName = path.basename(zipFilePath);


    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", stats.size.toString());
    res.setHeader("Cache-Control", "no-cache");


    const fileStream = fs.createReadStream(zipFilePath);
    const zipPathToDelete = zipFilePath;

    fileStream.on("end", () => {

      setTimeout(() => {
        try {
          if (fs.existsSync(zipPathToDelete)) {
            fs.unlinkSync(zipPathToDelete);
            console.log(`Cleaned up temporary ZIP: ${zipPathToDelete}`);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up ZIP file:", cleanupError);
        }
      }, 1000);
    });

    fileStream.on("error", (error: Error) => {
      console.error("Stream error:", error);
      try {
        if (fs.existsSync(zipPathToDelete)) {
          fs.unlinkSync(zipPathToDelete);
          console.log(`Cleaned up ZIP after error: ${zipPathToDelete}`);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up ZIP file:", cleanupError);
      }
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming file" });
      }
    });


    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading ZIP:", error);

    if (zipFilePath && fs.existsSync(zipFilePath)) {
      try {
        fs.unlinkSync(zipFilePath);
        console.log(`Cleaned up ZIP after error: ${zipFilePath}`);
      } catch (cleanupError) {
        console.error("Error cleaning up ZIP file:", cleanupError);
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to download ZIP file" });
    }
  }
};

const getFileSaveHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    const query = `
          SELECT 
            gfsl.id,
            gfsl.controller_id,
            gfsl.ip_address,
            gfsl.file_name,
            gfsl.status,
            gfsl.created_at,
            c.name as controller_name,
            c.model as controller_model
          FROM general_file_save_log gfsl
          LEFT JOIN controller c ON gfsl.controller_id = c.id
          WHERE gfsl.controller_id = $1
          ORDER BY gfsl.created_at DESC
          LIMIT 50
        `;

    const result = await dbPool.query(query, [controllerId]);

    const transformedData = result.rows.map((row) => ({
      ...row,
      status_text: row.status ? "Success" : "Failed",
      status_icon: row.status ? "OK" : "NOT OK",
    }));

    return res.status(200).json(transformedData);
  } catch (error) {
    console.error("Error fetching file save history:", error);
    return res.status(500).json({ error: "Failed to fetch file save history" });
  }
};

const getLogFileContentByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {

    if (controllerId === "all") {
      return await handleAllControllers();
    }

    const controllerQuery = `SELECT ip_address FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const ipAddress = controllerResult.rows[0].ip_address;

    const fileName = "LOGDATA.DAT";
    const folderName = `${ipAddress}_LOGDATA`;

    const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

    const filePath = path.join(baseDir, folderName, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: "Log file not found. Please fetch log data first.",
        filePath,
      });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");

    const stats = fs.statSync(filePath);

    const logEntries = parseLogContent(fileContent);

    return res.status(200).json({
      success: true,
      data: logEntries,
      filePath,
      lastModified: stats.mtime.toISOString(),
    });
  } catch (error) {
    console.error("Error reading log file content:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to read log file content: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

const getReadFileBySessionIdWithFileName = async (req: Request, res: Response) => {
  const { sessionId, fileName } = req.params;

  if (!sessionId || !fileName) {
    return res.status(400).json({ success: false, error: "Session ID and file name are required" });
  }

  try {
    const sessionQuery = `
          SELECT 
            bs.controller_ip,
            bs.session_start_time,
            bs.backup_folder_path,
            c.name as controller_name,
            c.ip_address
          FROM backup_sessions bs
          LEFT JOIN controller c ON bs.controller_id = c.id
          WHERE bs.id = $1
        `;

    const sessionResult = await dbPool.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Backup session not found" });
    }

    const session = sessionResult.rows[0];
    const controllerIp = session.ip_address || session.controller_ip;
    const sessionTime = new Date(session.session_start_time);

    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    let folderPath: string | null = null;

    if (session.backup_folder_path && fs.existsSync(session.backup_folder_path)) {
      const testPath = path.join(session.backup_folder_path, fileName);
      if (fs.existsSync(testPath)) folderPath = session.backup_folder_path;
    }

    if (!folderPath) {
      const resolved = resolveBackupFolder(backupBaseDir, controllerIp, session.controller_name, sessionTime, [
        fileName,
      ]);
      if (resolved) {
        folderPath = resolved.folderPath;
        await dbPool.query(`UPDATE backup_sessions SET backup_folder_path = $1 WHERE id = $2`, [
          resolved.folderPath,
          sessionId,
        ]);
      }
    }

    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: "Backup folder or file not found on disk",
      });
    }

    const filePath = path.join(folderPath, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: "File not found on disk",
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
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

const getSessionFolderFilesBySessionId = async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const sessionQuery = `
          SELECT 
            bs.controller_ip,
            bs.session_start_time,
            bs.backup_folder_path,
            c.name as controller_name,
            c.ip_address
          FROM backup_sessions bs
          LEFT JOIN controller c ON bs.controller_id = c.id
          WHERE bs.id = $1
        `;

    const sessionResult = await dbPool.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup session not found" });
    }

    const session = sessionResult.rows[0];
    const controllerIp = session.ip_address || session.controller_ip;
    const sessionTime = new Date(session.session_start_time);

    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    let backupFolderPath: string | null = null;

    if (session.backup_folder_path && fs.existsSync(session.backup_folder_path)) {
      backupFolderPath = session.backup_folder_path;
    } else {
      const filesResult = await dbPool.query(
        `SELECT file_name FROM backup_file_details WHERE session_id = $1 AND backup_status = true`,
        [sessionId]
      );
      const expectedFileNames = filesResult.rows.map((r: { file_name: string }) => r.file_name);
      const resolved = resolveBackupFolder(
        backupBaseDir,
        controllerIp,
        session.controller_name,
        sessionTime,
        expectedFileNames
      );
      if (resolved) {
        backupFolderPath = resolved.folderPath;
        await dbPool.query(`UPDATE backup_sessions SET backup_folder_path = $1 WHERE id = $2`, [
          resolved.folderPath,
          sessionId,
        ]);
      }
    }

    if (!backupFolderPath) {
      return res.status(400).json({
        success: false,
        error: "Backup folder not found on disk",
      });
    }

    const files = fs.readdirSync(backupFolderPath);

    const fileDetails = files.map((fileName) => {
      const filePath = path.join(backupFolderPath!, fileName);
      const stats = fs.statSync(filePath);
      const extension = path.extname(fileName).toLowerCase();

      return {
        name: fileName,
        type: extension || "unknown",
        size: stats.size,
        modified: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory(),
      };
    });

    return res.status(200).json({
      success: true,
      folderPath: backupFolderPath,
      totalFiles: files.length,
      files: fileDetails,
    });
  } catch (error) {
    console.error("Error reading backup folder:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to read backup folder",
    });
  }
};

const deleteBackupSessionBySessionId = async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const client = await dbPool.connect();

  try {

    const sessionQuery = `
      SELECT 
        bs.controller_ip,
        bs.session_start_time,
        bs.backup_folder_path,
        c.name as controller_name,
        c.ip_address
      FROM backup_sessions bs
      LEFT JOIN controller c ON bs.controller_id = c.id
      WHERE bs.id = $1
    `;
    const sessionResult = await client.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup session not found" });
    }

    const session = sessionResult.rows[0];
    const controllerIp = session.ip_address || session.controller_ip;
    const sessionTime = new Date(session.session_start_time);

    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    let deletedFolderPath: string | null = null;

    if (session.backup_folder_path && fs.existsSync(session.backup_folder_path)) {
      try {
        fs.rmSync(session.backup_folder_path, { recursive: true, force: true });
        deletedFolderPath = session.backup_folder_path;
        console.log(`Deleted backup folder: ${deletedFolderPath}`);
      } catch (fsError) {
        console.error(`Failed to delete backup folder ${session.backup_folder_path}:`, fsError);
      }
    } else {
      const filesResult = await client.query(
        `SELECT file_name FROM backup_file_details WHERE session_id = $1 AND backup_status = true`,
        [sessionId]
      );
      const expectedFileNames = filesResult.rows.map((r: { file_name: string }) => r.file_name);
      const resolved = resolveBackupFolder(
        backupBaseDir,
        controllerIp,
        session.controller_name,
        sessionTime,
        expectedFileNames
      );
      if (resolved) {
        try {
          fs.rmSync(resolved.folderPath, { recursive: true, force: true });
          deletedFolderPath = resolved.folderPath;
          console.log(`Deleted backup folder: ${deletedFolderPath}`);
        } catch (fsError) {
          console.error(`Failed to delete backup folder ${resolved.folderPath}:`, fsError);
        }
      }
    }


    await client.query("BEGIN");

    await client.query(`DELETE FROM backup_file_details WHERE session_id = $1`, [sessionId]);

    const result = await client.query(`DELETE FROM backup_sessions WHERE id = $1 RETURNING *`, [sessionId]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Backup session not found" });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Backup session deleted successfully",
      deletedFolder: deletedFolderPath,
      folderDeleted: deletedFolderPath !== null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting backup session:", error);
    return res.status(500).json({ error: "Failed to delete backup session" });
  } finally {
    client.release();
  }
};

// Get all backup folders from disk for a specific controller
const getBackupFoldersForController = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    // Get controller info
    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];
    const controllerIp = controller.ip_address;
    const controllerName = controller.name;

    // Get backup base directory based on OS
    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    // Check if backup directory exists
    if (!fs.existsSync(backupBaseDir)) {
      return res.status(200).json({
        success: true,
        controllerId,
        controllerIp,
        controllerName,
        backupBaseDir,
        folders: [],
        message: "Backup directory does not exist",
      });
    }


    const allFolders = fs.readdirSync(backupBaseDir);


    const controllerFolders = allFolders.filter((folder) => {

      return folder.includes(controllerIp) || (controllerName && folder.startsWith(controllerName + "_"));
    });


    const folderDetails = controllerFolders.map((folderName) => {
      const folderPath = path.join(backupBaseDir, folderName);
      const stats = fs.statSync(folderPath);


      const dateMatch = folderName.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})/);
      let parsedDate = null;
      if (dateMatch) {
        const [, year, month, day, hour, minute] = dateMatch;
        parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      }


      let fileCount = 0;
      try {
        const files = fs.readdirSync(folderPath);
        fileCount = files.filter((f) => fs.statSync(path.join(folderPath, f)).isFile()).length;
      } catch (e) {

      }

      return {
        name: folderName,
        path: folderPath,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        parsedDate: parsedDate ? parsedDate.toISOString() : null,
        fileCount,
      };
    });


    folderDetails.sort((a, b) => {
      const dateA = a.parsedDate || a.createdAt;
      const dateB = b.parsedDate || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return res.status(200).json({
      success: true,
      controllerId,
      controllerIp,
      controllerName,
      backupBaseDir,
      folders: folderDetails,
    });
  } catch (error) {
    console.error("Error getting backup folders:", error);
    return res.status(500).json({ error: "Failed to get backup folders" });
  }
};


const getBackupFolderFiles = async (req: Request, res: Response) => {
  const { folderName } = req.params;

  if (!folderName) {
    return res.status(400).json({ error: "Folder name is required" });
  }

  try {
    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    const folderPath = path.join(backupBaseDir, folderName);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: "Backup folder not found", folderPath });
    }

    const files = fs.readdirSync(folderPath);

    const fileDetails = files.map((fileName) => {
      const filePath = path.join(folderPath, fileName);
      const stats = fs.statSync(filePath);
      const extension = path.extname(fileName).toLowerCase();

      return {
        name: fileName,
        type: extension.replace(".", "") || "unknown",
        size: stats.size,
        modified: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory(),
      };
    });


    fileDetails.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      folderName,
      folderPath,
      totalFiles: fileDetails.length,
      files: fileDetails,
    });
  } catch (error) {
    console.error("Error reading backup folder:", error);
    return res.status(500).json({ error: "Failed to read backup folder" });
  }
};


const getBackupFileContent = async (req: Request, res: Response) => {
  const { folderName, fileName } = req.params;

  if (!folderName || !fileName) {
    return res.status(400).json({ error: "Folder name and file name are required" });
  }

  try {
    const backupBaseDir =
      process.env.WATCHLOG_BACKUP_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Backup" : path.join(os.homedir(), "Watchlog", "Backup"));

    const filePath = path.join(backupBaseDir, folderName, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found", filePath });
    }

    const stats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    return res.status(200).json({
      success: true,
      fileName,
      folderName,
      content: fileContent,
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return res.status(500).json({ error: "Failed to read file" });
  }
};

export {
  getBackupHistoryByControllerId,
  getBackupSessionBySessionId,
  deleteBackupSessionBySessionId,
  createZipBySessionId,
  downloadZipBySessionId,
  getFileSaveHistory,
  getLogFileContentByControllerId,
  getReadFileBySessionIdWithFileName,
  getSessionFolderFilesBySessionId,
  getBackupFoldersForController,
  getBackupFolderFiles,
  getBackupFileContent,
};
