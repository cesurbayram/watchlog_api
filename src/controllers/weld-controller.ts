import { Request, Response } from "express";
import { dbPool } from "../config/db";
import fs from "fs";
import path from "path";
import os from "os";

function getWeldDirectory(ipAddress: string): string {
  const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));
  return path.join(baseDir, `${ipAddress}_Weld`);
}

function listDateFolders(weldDir: string): string[] {
  if (!fs.existsSync(weldDir)) return [];

  return fs
    .readdirSync(weldDir)
    .filter((folder) => {
      const folderPath = path.join(weldDir, folder);
      return fs.statSync(folderPath).isDirectory() && /^\d{4}-\d{2}-\d{2}_[Ww]eld$/.test(folder);
    })
    .sort()
    .reverse();
}

function listHourlyFiles(dateFolderPath: string): string[] {
  if (!fs.existsSync(dateFolderPath)) return [];

  return fs
    .readdirSync(dateFolderPath)
    .filter((file) => file.endsWith(".csv"))
    .sort()
    .reverse();
}

const getWeldData = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;
    const { date: dateFilter, hour: hourFilter, page = "1", limit = "20", search = "" } = req.query;

    const arcFunctionResult = await dbPool.query(`SELECT ip_address, machine_name, machine_type FROM arc_function WHERE id = $1`, [arcFunctionId]);

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress, machine_name: machineName, machine_type: machineType } = arcFunctionResult.rows[0];

    const weldDir = getWeldDirectory(ipAddress);

    if (!fs.existsSync(weldDir)) {
      return res.status(200).json({
        arcFunctionId,
        ipAddress,
        machineName,
        files: [],
        dateFolders: [],
        partSummaries: [],
        message: "No weld data directory found",
      });
    }

    const dateFolders = listDateFolders(weldDir);

    return res.status(200).json({
      arcFunctionId,
      ipAddress,
      machineName,
      machineType,
      dateFolders,
      message: "Full weld data parsing requires additional utilities",
    });
  } catch (error) {
    console.error("Error fetching weld data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getWeldDates = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;

    const arcFunctionResult = await dbPool.query(`SELECT ip_address, machine_name, machine_type FROM arc_function WHERE id = $1`, [arcFunctionId]);

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress, machine_name: machineName, machine_type: machineType } = arcFunctionResult.rows[0];

    const weldDir = getWeldDirectory(ipAddress);

    if (!fs.existsSync(weldDir)) {
      return res.status(200).json({
        arcFunctionId,
        ipAddress,
        machineName,
        machineType,
        dates: [],
        message: "No weld data directory found",
      });
    }

    const dateFolders = listDateFolders(weldDir);

    interface DateInfo {
      date: string;
      folderName: string;
      hourlyFiles: string[];
    }

    const dates: DateInfo[] = [];

    for (const folderName of dateFolders) {
      const dateMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})_[Ww]eld$/);
      if (dateMatch) {
        const dateFolderPath = path.join(weldDir, folderName);
        const hourlyFiles = listHourlyFiles(dateFolderPath);

        dates.push({
          date: dateMatch[1],
          folderName,
          hourlyFiles,
        });
      }
    }

    if (dates.length === 0) {
      const files = fs.readdirSync(weldDir);
      const csvFiles = files.filter(
        (file) => (file.endsWith("_Weld.csv") || file.endsWith("_weld.csv")) && fs.statSync(path.join(weldDir, file)).isFile(),
      );

      for (const csvFile of csvFiles) {
        const dateMatch = csvFile.match(/^(\d{4}-\d{2}-\d{2})_[Ww]eld\.csv$/);
        if (dateMatch) {
          dates.push({
            date: dateMatch[1],
            folderName: "",
            hourlyFiles: [csvFile],
          });
        }
      }
    }

    dates.sort((a, b) => b.date.localeCompare(a.date));

    return res.status(200).json({
      arcFunctionId,
      ipAddress,
      machineName,
      machineType,
      dates: dates,
    });
  } catch (error) {
    console.error("Error fetching weld dates:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getWeldSeams = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;
    const { partSerialId, partItemNumber, jobName, date, seamNumber, startTime } = req.query;

    if (!partSerialId && !partItemNumber) {
      return res.status(400).json({ message: "partSerialId or partItemNumber is required" });
    }

    const arcFunctionResult = await dbPool.query(`SELECT ip_address FROM arc_function WHERE id = $1`, [arcFunctionId]);

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress } = arcFunctionResult.rows[0];
    const weldDir = getWeldDirectory(ipAddress);

    if (!fs.existsSync(weldDir)) {
      return res.status(200).json({
        partSerialId: partSerialId || null,
        partItemNumber: partItemNumber || null,
        seams: [],
        otherOperations: [],
      });
    }

    return res.status(200).json({
      partSerialId: partSerialId || null,
      partItemNumber: partItemNumber || null,
      seams: [],
      otherOperations: [],
      message: "Full seam data parsing requires additional utilities",
    });
  } catch (error) {
    console.error("Error fetching seam data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getWeldActual = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;
    const { partSerialId, partItemNumber, jobName, seamNumber, operationIndex, date } = req.query;

    if ((!partSerialId && !partItemNumber) || !seamNumber) {
      return res.status(400).json({
        message: "(partSerialId or partItemNumber) and seamNumber are required",
      });
    }

    const arcFunctionResult = await dbPool.query(`SELECT ip_address FROM arc_function WHERE id = $1`, [arcFunctionId]);

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress } = arcFunctionResult.rows[0];
    const weldDir = getWeldDirectory(ipAddress);

    if (!fs.existsSync(weldDir)) {
      return res.status(200).json({
        partSerialId: partSerialId || null,
        partItemNumber: partItemNumber || null,
        seamNumber: parseInt(seamNumber as string),
        operationIndex: operationIndex ? parseInt(operationIndex as string) : null,
        actualData: [],
      });
    }

    return res.status(200).json({
      partSerialId: partSerialId || null,
      partItemNumber: partItemNumber || null,
      seamNumber: parseInt(seamNumber as string),
      operationIndex: operationIndex ? parseInt(operationIndex as string) : null,
      actualData: [],
      message: "Full actual data parsing requires additional utilities",
    });
  } catch (error) {
    console.error("Error fetching actual data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { getWeldData, getWeldDates, getWeldSeams, getWeldActual };
