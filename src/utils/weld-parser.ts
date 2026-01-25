import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
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
}

export function getWeldDirectory(ipAddress: string): string {
  const baseDir =
    process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\Weld" : path.join(os.homedir(), "Watchlog", "Weld"));

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
  const csvFiles = files.filter((file) => file.endsWith("_Weld.csv") || file.endsWith("_weld.csv"));

  return csvFiles.sort();
}

export function readDateFolderData(dateFolderPath: string): WeldRawData[] {
  const hourlyFiles = listHourlyFiles(dateFolderPath);
  const allData: WeldRawData[] = [];

  for (const csvFile of hourlyFiles) {
    const filePath = path.join(dateFolderPath, csvFile);
    const data = readWeldCSV(filePath);
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
    const csvFiles = files.filter((file) => file.endsWith("_Weld.csv") || file.endsWith("_weld.csv"));

    for (const csvFile of csvFiles) {
      const filePath = path.join(weldDir, csvFile);
      const data = readWeldCSV(filePath);
      allData.push(...data);
    }
  }

  return allData;
}

export function readWeldCSV(filePath: string): WeldRawData[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    let csvContent = fs.readFileSync(filePath, "utf-8");

    if (csvContent.charCodeAt(0) === 0xfeff) {
      csvContent = csvContent.slice(1);
    }

    const lines = csvContent.split(/\r?\n/);

    let startIndex = 0;
    if (lines[0].startsWith("sep=")) {
      startIndex = 1;
    }

    const headerLine = lines[startIndex];
    let delimiter = ",";

    if (headerLine) {
      const semicolonCount = (headerLine.match(/;/g) || []).length;
      const commaCount = (headerLine.match(/,/g) || []).length;

      if (semicolonCount > commaCount) {
        delimiter = ";";
      }
    }

    if (lines[0].startsWith("sep=")) {
      delimiter = lines[0].charAt(4);
      csvContent = lines.slice(1).join("\n");
    }

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter,
      relax_column_count: true,
      bom: true,
    });

    return records.map((record: any) => mapCsvToWeldData(record));
  } catch (error) {
    console.error(`Error reading CSV file ${filePath}:`, error);
    return [];
  }
}

function getColumnValue(record: any, columnName: string): string {
  if (record[columnName] !== undefined) {
    return record[columnName];
  }

  const keys = Object.keys(record);
  for (const key of keys) {
    if (key.trim().toUpperCase() === columnName.toUpperCase()) {
      return record[key];
    }
  }

  return "";
}

export function mapCsvToWeldData(record: any): WeldRawData {
  const parseNumber = (value: any): number | null => {
    if (value === undefined || value === null || value === "") return null;
    const num = parseFloat(String(value).replace(",", "."));
    return isNaN(num) ? null : num;
  };

  const getValue = (col: string) => getColumnValue(record, col);

  return {
    date: getValue("DATE"),
    time: getValue("TIME"),
    factory: getValue("FACTORY"),
    line: getValue("LINE"),
    cell: getValue("CELL"),
    partSerialId: String(getValue("PART SERIAL ID") || ""),
    partItemNumber: getValue("PART ITEM NUMBER"),
    partVersion: getValue("PART VERSION"),
    jobName: getValue("JOB NAME"),
    seamNumber: parseInt(getValue("SEAM NUMBER")) || 0,
    weldLength: parseNumber(getValue("WELD LENGHT (mm)")) || 0,
    setVoltage: parseNumber(getValue("SET VOLTAGE (V)")),
    setCurrent: parseNumber(getValue("SET CURRENT (A)")),
    averageVoltage: parseNumber(getValue("AVARAGE VOLTAGE (V)")),
    averageCurrent: parseNumber(getValue("AVARAGE CURRENT (A)")),
    actualVoltage: parseNumber(getValue("ACTUAL VOLTAGE (V)")),
    actualCurrent: parseNumber(getValue("ACTUAL CURRENT (A)")),
    wireSpeed: parseNumber(getValue("WIRE SPEED (mm/s)")),
    torqueM1: parseNumber(getValue("TORQUE M1 (N)")),
    torqueM2: parseNumber(getValue("TORQUE M2 (N)")),
    averageGasFlow: parseNumber(getValue("AVARAGE GAS FLOW")),
    actualGasFlow: parseNumber(getValue("ACTUAL GAS FLOW")),
    gasConsumption: parseNumber(getValue("GAS CONSUMPTION")),
    weldDuration: parseNumber(getValue("WELD DURATION (s)")),
    weldingSpeed: parseNumber(getValue("WELDING SPEED (mm/s)")),
    wireConsumption: parseNumber(getValue("WIRE CONSUMPTION (mm)")),
    machine: getValue("MACHINE"),
    processTime: getValue("PROCESS TIME") || null,
    ipAddress: getValue("IP ADRESS") || getValue("IP ADDRESS"),
    toolNo: parseNumber(getValue("TOOL NO")),
    dataPart: parseNumber(getValue("DATA PART")),
  };
}
