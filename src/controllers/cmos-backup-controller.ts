import { Request, Response } from "express";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import archiver from "archiver";

const getBackupHistoryByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    let query: string;
    let queryParams: string[];

    if (controllerId === "all") {
      // Get all backup sessions from all controllers
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
      // Get sessions for specific controller
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
    return res.status(200).json(result.rows);
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
    // Opsiyonel: Kategori bazlı dosya filtresi
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
      // Body yoksa tüm dosyaları indir
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

    const year = sessionTime.getFullYear();
    const month = String(sessionTime.getMonth() + 1).padStart(2, "0");
    const day = String(sessionTime.getDate()).padStart(2, "0");
    const hour = String(sessionTime.getHours()).padStart(2, "0");
    const minute = String(sessionTime.getMinutes()).padStart(2, "0");

    const possibleFolderNames = [
      `or_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      `or1_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      `or2_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      controllerIp,
    ];

    if (session.controller_name) {
      possibleFolderNames.unshift(`${session.controller_name}_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`);
    }

    let controllerBackupDir: string | null = null;
    let backupFolderName: string | null = null;
    for (const folderName of possibleFolderNames) {
      const testPath = path.join(backupBaseDir, folderName);
      if (fs.existsSync(testPath)) {
        controllerBackupDir = testPath;
        backupFolderName = folderName;
        console.log(`Found backup folder: ${testPath}`);
        break;
      }
    }

    if (!controllerBackupDir || !backupFolderName) {
      return res.status(404).json({
        error: "Backup directory not found",
        message: `Could not find backup folder for session ${sessionId}`,
        searchedPaths: possibleFolderNames.map((f) => path.join(backupBaseDir, f)),
        hint: "Make sure backup files have been created first",
      });
    }

    const tempDir = os.tmpdir();
    // Kategori varsa farklı isimle kaydet
    const zipFileName = categoryName ? `${backupFolderName}_${categoryName.replace(/[^a-zA-Z0-9]/g, "_")}.zip` : `${backupFolderName}.zip`;
    const zipFilePath = path.join(tempDir, zipFileName);

    // Kategori bazlı ise her zaman yeni ZIP oluştur, değilse cache kullan
    if (!fileFilter && fs.existsSync(zipFilePath)) {
      return res.status(400).json({
        success: true,
        message: "ZIP file already exists",
        zipFileName,
        fileCount: filesResult.rows.length,
      });
    }

    // Filtrelenecek dosyaları belirle
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
        const sourceFilePath = path.join(controllerBackupDir, file.file_name);

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

    const year = sessionTime.getFullYear();
    const month = String(sessionTime.getMonth() + 1).padStart(2, "0");
    const day = String(sessionTime.getDate()).padStart(2, "0");
    const hour = String(sessionTime.getHours()).padStart(2, "0");
    const minute = String(sessionTime.getMinutes()).padStart(2, "0");

    const possibleFolderNames = [
      `or_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      `or1_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      `or2_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`,
      controllerIp,
    ];

    if (session.controller_name) {
      possibleFolderNames.unshift(`${session.controller_name}_${controllerIp}_${year}-${month}-${day}_${hour}_${minute}`);
    }

    const tempDir = os.tmpdir();
    const categorySuffix = category ? `_${(category as string).replace(/[^a-zA-Z0-9]/g, "_")}` : "";

    for (const folderName of possibleFolderNames) {
      if (category) {
        const categoryZipPath = path.join(tempDir, `${folderName}${categorySuffix}.zip`);
        if (fs.existsSync(categoryZipPath)) {
          zipFilePath = categoryZipPath;
          console.log(`Found category ZIP file: ${categoryZipPath}`);
          break;
        }
      }

      const testZipPath = path.join(tempDir, `${folderName}.zip`);
      if (fs.existsSync(testZipPath)) {
        zipFilePath = testZipPath;
        console.log(`Found ZIP file: ${testZipPath}`);
        break;
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

    const fileStream = fs.createReadStream(zipFilePath);
    const zipPathToDelete = zipFilePath;

    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        fileStream.on("end", () => {
          controller.close();

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
          controller.error(error);

          try {
            if (fs.existsSync(zipPathToDelete)) {
              fs.unlinkSync(zipPathToDelete);
              console.log(`Cleaned up ZIP after error: ${zipPathToDelete}`);
            }
          } catch (cleanupError) {
            console.error("Error cleaning up ZIP file:", cleanupError);
          }
        });
      },
      cancel() {
        fileStream.destroy();
        try {
          if (fs.existsSync(zipPathToDelete)) {
            fs.unlinkSync(zipPathToDelete);
            console.log(`Cleaned up ZIP after cancel: ${zipPathToDelete}`);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up ZIP file:", cleanupError);
        }
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Content-Length", stats.size.toString());
    headers.set("Cache-Control", "no-cache");

    return res.status(200).json({
      stream,
      headers: headers,
    });
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

    return res.status(500).json({ error: "Failed to download ZIP file" });
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
