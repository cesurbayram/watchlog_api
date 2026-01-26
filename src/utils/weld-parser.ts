import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import os from "os";

export interface WeldRawData {
  date: string;
  time: string;
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
  partVersion: string;
  jobName: string;
  seamNumber: number;
  weldLength: number;
  setVoltage: number | null;
  setCurrent: number | null;
  averageVoltage: number | null;
  averageCurrent: number | null;
  actualVoltage: number | null;
  actualCurrent: number | null;
  wireSpeed: number | null;
  torqueM1: number | null;
  torqueM2: number | null;
  averageGasFlow: number | null;
  actualGasFlow: number | null;
  gasConsumption: number | null;
  weldDuration: number | null;
  weldingSpeed: number | null;
  wireConsumption: number | null;
  machine: string;
  processTime: string | null;
  ipAddress: string;
  toolNo: number | null;
  dataPart: number | null;
  groupType: string | null;
}

interface WeldHeaderRow {
  DataPart: string;
  Factory: string;
  Line: string;
  Cell: string;
  PartSerialID: string;
  PartItemNumber: string;
  PartVersion: string;
  SeamNumber: number;
  ToolNo: number | null;
  WeldLength: number;
  SetVoltage: number | null;
  SetCurrent: number | null;
  AvarageVoltage: number | null;
  AvarageCurrent: number | null;
  AvarageGasFlow: number | null;
  GasConsumption: number | null;
  WeldDuration: number | null;
  WeldingSpeed: number | null;
  WireConsumption: number | null;
  MachineName: string;
  IpAdress: string;
  JobName: string;
  GroupType: string | null;
}

interface WeldDetailRow {
  Id: number;
  DataPart: string;
  DateTime: string;
  ActualVoltage: number | null;
  ActualCurrent: number | null;
  WireSpeed: number | null;
  MotorTorqueM1: number | null;
  MotorTorqueM2: number | null;
  ActualGasFlow: number | null;
}

interface JoinedWeldRow extends WeldHeaderRow, Omit<WeldDetailRow, "DataPart"> {}

export function getWeldDirectory(ipAddress: string): string {
  const baseDir = process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Weld" : path.join(os.homedir(), "Watchlog", "Weld"));

  return path.join(baseDir, `${ipAddress}_Weld`);
}

export function listDateFolders(weldDir: string): string[] {
  if (!fs.existsSync(weldDir)) {
    return [];
  }

  const items = fs.readdirSync(weldDir);
  const dateFolders = items.filter((item) => {
    const itemPath = path.join(weldDir, item);
    return fs.statSync(itemPath).isDirectory() && (item.endsWith("_Weld") || item.endsWith("_weld"));
  });

  return dateFolders.sort((a, b) => b.localeCompare(a));
}

export function listHourlyFiles(dateFolderPath: string): string[] {
  if (!fs.existsSync(dateFolderPath)) {
    return [];
  }

  const files = fs.readdirSync(dateFolderPath);

  const dbFiles = files.filter((file) => file.endsWith("_Weld.db") || file.endsWith("_weld.db"));

  return dbFiles.sort();
}

export function readDateFolderData(dateFolderPath: string): WeldRawData[] {
  const hourlyFiles = listHourlyFiles(dateFolderPath);
  const allData: WeldRawData[] = [];

  for (const dbFile of hourlyFiles) {
    const filePath = path.join(dateFolderPath, dbFile);
    const data = readWeldSQLite(filePath);
    allData.push(...data);
  }

  return allData;
}

export function readAllWeldData(weldDir: string): WeldRawData[] {
  if (!fs.existsSync(weldDir)) {
    return [];
  }

  const allData: WeldRawData[] = [];

  const dateFolders = listDateFolders(weldDir);

  if (dateFolders.length > 0) {
    for (const dateFolder of dateFolders) {
      const dateFolderPath = path.join(weldDir, dateFolder);
      const data = readDateFolderData(dateFolderPath);
      allData.push(...data);
    }
  } else {
    const files = fs.readdirSync(weldDir);
    const dbFiles = files.filter((file) => file.endsWith("_Weld.db") || file.endsWith("_weld.db"));

    for (const dbFile of dbFiles) {
      const filePath = path.join(weldDir, dbFile);
      const data = readWeldSQLite(filePath);
      allData.push(...data);
    }
  }

  return allData;
}

export function readWeldSQLite(filePath: string): WeldRawData[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const db = new Database(filePath, { readonly: true });

    const query = `
      SELECT 
        h.DataPart,
        h.Factory,
        h.Line,
        h.Cell,
        h.PartSerialID,
        h.PartItemNumber,
        h.PartVersion,
        h.SeamNumber,
        h.ToolNo,
        h.WeldLength,
        h.SetVoltage,
        h.SetCurrent,
        h.AvarageVoltage,
        h.AvarageCurrent,
        h.AvarageGasFlow,
        h.GasConsumption,
        h.WeldDuration,
        h.WeldingSpeed,
        h.WireConsumption,
        h.MachineName,
        h.IpAdress,
        h.JobName,
        h.GroupType,
        d.Id,
        d.DateTime,
        d.ActualVoltage,
        d.ActualCurrent,
        d.WireSpeed,
        d.MotorTorqueM1,
        d.MotorTorqueM2,
        d.ActualGasFlow
      FROM WeldHeaders h
      INNER JOIN WeldDetails d ON h.DataPart = d.DataPart
      ORDER BY d.DateTime
    `;

    const rows = db.prepare(query).all() as JoinedWeldRow[];
    db.close();

    return rows.map((row) => mapSqliteToWeldData(row));
  } catch (error) {
    console.error(`Error reading SQLite file ${filePath}:`, error);
    return [];
  }
}

function mapSqliteToWeldData(row: JoinedWeldRow): WeldRawData {
  let date = "";
  let time = "";

  if (row.DateTime) {
    const parts = row.DateTime.split(" ");
    date = parts[0] || "";
    time = parts[1] || "";

    if (time.includes(".")) {
      const timeParts = time.split(".");
      const hms = timeParts[0];
      const ms = timeParts[1] || "0";
      time = `${hms}:${ms.padEnd(3, "0").substring(0, 3)}`;
    }
  }

  return {
    date,
    time,
    factory: row.Factory || "",
    line: row.Line || "",
    cell: row.Cell || "",
    partSerialId: row.PartSerialID || "",
    partItemNumber: row.PartItemNumber || "",
    partVersion: row.PartVersion || "",
    jobName: row.JobName || "",
    seamNumber: row.SeamNumber || 0,
    weldLength: row.WeldLength || 0,
    setVoltage: row.SetVoltage,
    setCurrent: row.SetCurrent,
    averageVoltage: row.AvarageVoltage,
    averageCurrent: row.AvarageCurrent,
    actualVoltage: row.ActualVoltage,
    actualCurrent: row.ActualCurrent,
    wireSpeed: row.WireSpeed,
    torqueM1: row.MotorTorqueM1,
    torqueM2: row.MotorTorqueM2,
    averageGasFlow: row.AvarageGasFlow,
    actualGasFlow: row.ActualGasFlow,
    gasConsumption: row.GasConsumption,
    weldDuration: row.WeldDuration,
    weldingSpeed: row.WeldingSpeed,
    wireConsumption: row.WireConsumption,
    machine: row.MachineName || "",
    processTime: null,
    ipAddress: row.IpAdress || "",
    toolNo: row.ToolNo,
    dataPart: row.DataPart ? parseInt(row.DataPart) || null : null,
    groupType: row.GroupType || null,
  };
}
