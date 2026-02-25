import { Request, Response } from "express";
import { dbPool } from "../config/db";
import WeldHeaderModel from "../models/mongo/weld-header.model";
import WeldDetailModel from "../models/mongo/weld-detail.model";
import { WeldRawData, WeldPartSummary, WeldSeamSummary, FlatSeamRow, WeldSeamDetail, WeldActualData } from "../models/weld-dto";

function parseTimeToMs(time: string): number {
  const parts = time.split(":");
  if (parts.length < 3) return 0;

  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  const ms = parts.length > 3 ? parseInt(parts[3]) || 0 : 0;

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}

function safeNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (!Number.isFinite(val)) return 0;
  return val;
}

async function fetchWeldRawData(ipAddress: string, dateFilter?: string): Promise<WeldRawData[]> {
  const headerFilter: any = { IpAdress: ipAddress };

  if (dateFilter) {
    const startDate = new Date(dateFilter);
    const endDate = new Date(dateFilter);
    endDate.setDate(endDate.getDate() + 1);
    headerFilter.CreatedAt = { $gte: startDate, $lt: endDate };
  }

  const headers = await WeldHeaderModel.find(headerFilter).lean();

  if (headers.length === 0) return [];

  const dataParts = headers.map((h) => h._id);
  const details = await WeldDetailModel.find({ DataPart: { $in: dataParts } })
    .sort({ DateTime: 1 })
    .lean();

  const headerMap = new Map(headers.map((h) => [h._id, h]));

  const rawData: WeldRawData[] = details.map((d) => {
    const h = headerMap.get(d.DataPart);
    const dt = new Date(d.DateTime);
    const date = dt.toISOString().split("T")[0];
    const hours = dt.getUTCHours().toString().padStart(2, "0");
    const minutes = dt.getUTCMinutes().toString().padStart(2, "0");
    const seconds = dt.getUTCSeconds().toString().padStart(2, "0");
    const ms = dt.getUTCMilliseconds().toString().padStart(3, "0");
    const time = `${hours}:${minutes}:${seconds}:${ms}`;

    return {
      dataPart: d.DataPart,
      date,
      time,
      factory: h?.Factory || "",
      line: h?.Line || "",
      cell: h?.Cell || "",
      partSerialId: h?.PartSerialID || "",
      partItemNumber: h?.PartItemNumber || "",
      jobName: h?.JobName || "",
      seamNumber: h?.SeamNumber || 0,
      weldLength: safeNumber(h?.WeldLength),
      setVoltage: safeNumber(h?.SetVoltage),
      setCurrent: safeNumber(h?.SetCurrent),
      averageVoltage: safeNumber(h?.AvarageVoltage),
      averageCurrent: safeNumber(h?.AvarageCurrent),
      averageGasFlow: safeNumber(h?.AvarageGasFlow),
      averageWireSpeed: safeNumber(h?.AvarageWireSpeed),
      averageMotorTorqueM1: safeNumber(h?.AvarageMotorTorqueM1),
      averageMotorTorqueM2: safeNumber(h?.AvarageMotorTorqueM2),
      actualVoltage: safeNumber(d.ActualVoltage),
      actualCurrent: safeNumber(d.ActualCurrent),
      actualWireSpeed: safeNumber(d.ActualWireSpeed),
      torqueM1: safeNumber(d.MotorTorqueM1),
      torqueM2: safeNumber(d.MotorTorqueM2),
      actualGasFlow: safeNumber(d.ActualGasFlow),
      weldDuration: safeNumber(h?.WeldDuration),
      weldingSpeed: safeNumber(h?.WeldingSpeed),
      wireConsumption: safeNumber(h?.WireConsumption),
      machine: h?.MachineName || "",
      ipAddress: h?.IpAdress || "",
      toolNo: h?.ToolNo || 0,
      groupType: h?.GroupType || "",
    };
  });

  return rawData;
}

function createPartSummaries(rawData: WeldRawData[]): WeldPartSummary[] {
  const partMap = new Map<string, WeldRawData[]>();

  for (const data of rawData) {
    const key = `${data.factory}-${data.line}-${data.cell}-${data.partSerialId}-${data.partItemNumber}-${data.jobName}-${data.date}`;
    if (!partMap.has(key)) {
      partMap.set(key, []);
    }
    partMap.get(key)!.push(data);
  }

  const summaries: WeldPartSummary[] = [];
  for (const [_, records] of partMap) {
    if (records.length === 0) continue;

    const first = records[0];

    const sortedRecords = [...records].sort((a, b) => {
      return parseTimeToMs(a.time) - parseTimeToMs(b.time);
    });

    const seams: WeldSeamSummary[] = [];
    let currentSeamNumber: number | null = null;
    let currentDataPart: string | null = null;

    for (const record of sortedRecords) {
      const isNewOperation = currentSeamNumber === null || record.seamNumber !== currentSeamNumber || record.dataPart !== currentDataPart;

      if (isNewOperation) {
        seams.push({
          seamNumber: record.seamNumber,
          weldDuration: record.weldDuration,
          weldLength: record.weldLength,
          startTime: record.time,
          dataPart: record.dataPart,
          toolNo: record.toolNo,
          groupType: record.groupType,
        });
        currentSeamNumber = record.seamNumber;
        currentDataPart = record.dataPart;
      }
    }

    seams.sort((a, b) => parseTimeToMs(a.startTime) - parseTimeToMs(b.startTime));

    summaries.push({
      factory: first.factory,
      line: first.line,
      cell: first.cell,
      partSerialId: first.partSerialId,
      partItemNumber: first.partItemNumber,
      jobName: first.jobName,
      machine: first.machine,
      date: first.date,
      seamCount: seams.length,
      totalRecords: records.length,
      seams,
    });
  }

  return summaries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.partSerialId.localeCompare(a.partSerialId);
  });
}

function createFlatSeamRows(partSummaries: WeldPartSummary[]): FlatSeamRow[] {
  const rows: FlatSeamRow[] = [];

  for (const part of partSummaries) {
    if (part.seams && part.seams.length > 0) {
      for (const seam of part.seams) {
        rows.push({
          factory: part.factory,
          line: part.line,
          cell: part.cell,
          partSerialId: part.partSerialId,
          partItemNumber: part.partItemNumber,
          jobName: part.jobName,
          machine: part.machine,
          date: part.date,
          seamNumber: seam.seamNumber,
          startTime: seam.startTime,
          weldDuration: seam.weldDuration,
          weldLength: seam.weldLength,
          dataPart: seam.dataPart,
          toolNo: seam.toolNo,
          groupType: seam.groupType,
        });
      }
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.startTime.localeCompare(a.startTime);
  });

  return rows;
}

function createSeamDetails(rawData: WeldRawData[]): WeldSeamDetail[] {
  if (rawData.length === 0) return [];

  const sortedData = [...rawData].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const operations: { records: WeldRawData[]; operationIndex: number }[] = [];
  let currentOperation: WeldRawData[] = [];
  let currentSeamNumber: number | null = null;
  let currentDataPart: string | null = null;
  let operationIndex = 0;

  for (const data of sortedData) {
    const isNewOperation = currentSeamNumber === null || data.seamNumber !== currentSeamNumber || data.dataPart !== currentDataPart;

    if (isNewOperation) {
      if (currentOperation.length > 0) {
        operations.push({
          records: currentOperation,
          operationIndex: operationIndex,
        });
        operationIndex++;
      }

      currentOperation = [data];
      currentSeamNumber = data.seamNumber;
      currentDataPart = data.dataPart;
    } else {
      currentOperation.push(data);
    }
  }

  if (currentOperation.length > 0) {
    operations.push({
      records: currentOperation,
      operationIndex: operationIndex,
    });
  }

  const seams: WeldSeamDetail[] = operations.map((op) => {
    const first = op.records[0];
    return {
      seamNumber: first.seamNumber,
      operationIndex: op.operationIndex,
      startTime: first.time,
      weldLength: first.weldLength,
      weldDuration: first.weldDuration,
      weldingSpeed: first.weldingSpeed,
      wireConsumption: first.wireConsumption,
      setVoltage: first.setVoltage,
      setCurrent: first.setCurrent,
      averageVoltage: first.averageVoltage,
      averageCurrent: first.averageCurrent,
      averageGasFlow: first.averageGasFlow,
      averageWireSpeed: first.averageWireSpeed,
      averageMotorTorqueM1: first.averageMotorTorqueM1,
      averageMotorTorqueM2: first.averageMotorTorqueM2,
      recordCount: op.records.length,
      dataPart: first.dataPart,
      toolNo: first.toolNo,
    };
  });

  return seams.sort((a, b) => a.operationIndex - b.operationIndex);
}

const getWeldData = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;
    const { date: dateFilter, page = "1", limit = "20", search = "" } = req.query;

    const arcFunctionResult = await dbPool.query(
      `SELECT ip_address, machine_name, machine_type FROM arc_function WHERE id = $1`,
      [arcFunctionId],
    );

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress, machine_name: machineName } = arcFunctionResult.rows[0];

    const allRawData = await fetchWeldRawData(ipAddress, dateFilter as string | undefined);

    if (allRawData.length === 0) {
      return res.status(200).json({
        arcFunctionId,
        ipAddress,
        machineName,
        partSummaries: [],
        seamRows: [],
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      });
    }

    const partSummaries = createPartSummaries(allRawData);
    let seamRows = createFlatSeamRows(partSummaries);

    if ((search as string).trim()) {
      const term = (search as string).toLowerCase();
      seamRows = seamRows.filter((row) => {
        return (
          row.date?.toLowerCase().includes(term) ||
          row.factory?.toLowerCase().includes(term) ||
          row.line?.toLowerCase().includes(term) ||
          row.cell?.toLowerCase().includes(term) ||
          row.partItemNumber?.toLowerCase().includes(term) ||
          row.jobName?.toLowerCase().includes(term) ||
          row.machine?.toLowerCase().includes(term) ||
          row.seamNumber?.toString().includes(term) ||
          row.startTime?.toLowerCase().includes(term)
        );
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const totalItems = seamRows.length;
    const totalPages = Math.ceil(totalItems / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedRows = seamRows.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      arcFunctionId,
      ipAddress,
      machineName,
      partSummaries,
      seamRows: paginatedRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching weld data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getWeldDates = async (req: Request, res: Response) => {
  try {
    const { arcFunctionId } = req.params;

    const arcFunctionResult = await dbPool.query(
      `SELECT ip_address, machine_name, machine_type FROM arc_function WHERE id = $1`,
      [arcFunctionId],
    );

    if (arcFunctionResult.rowCount === 0) {
      return res.status(404).json({ message: "Arc Function not found" });
    }

    const { ip_address: ipAddress, machine_name: machineName, machine_type: machineType } = arcFunctionResult.rows[0];

    const dates = await WeldHeaderModel.aggregate([
      { $match: { IpAdress: ipAddress } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    return res.status(200).json({
      arcFunctionId,
      ipAddress,
      machineName,
      machineType,
      dates: dates.map((d) => ({
        date: d._id,
        weldCount: d.count,
      })),
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

    const allRawData = await fetchWeldRawData(ipAddress, date as string | undefined);

    const filteredData = allRawData.filter((d) => {
      let matchIdentifier = false;
      if (partSerialId) {
        matchIdentifier = d.partSerialId === partSerialId;
      } else if (partItemNumber) {
        matchIdentifier = d.partItemNumber === partItemNumber;
      }

      if (jobName && d.jobName !== jobName) {
        return false;
      }

      return matchIdentifier;
    });

    const allSeams = createSeamDetails(filteredData);

    if (seamNumber && startTime) {
      const seamNum = parseInt(seamNumber as string);
      const selectedSeam = allSeams.find((s) => s.seamNumber === seamNum && s.startTime === startTime);
      const otherOperations = allSeams.filter((s) => s.seamNumber === seamNum && s.startTime !== startTime);

      return res.status(200).json({
        partSerialId: partSerialId || null,
        partItemNumber: partItemNumber || null,
        seams: selectedSeam ? [selectedSeam] : [],
        otherOperations,
      });
    }

    if (seamNumber) {
      const seamNum = parseInt(seamNumber as string);
      const filteredSeams = allSeams.filter((s) => s.seamNumber === seamNum);

      return res.status(200).json({
        partSerialId: partSerialId || null,
        partItemNumber: partItemNumber || null,
        seams: filteredSeams,
        otherOperations: [],
      });
    }

    return res.status(200).json({
      partSerialId: partSerialId || null,
      partItemNumber: partItemNumber || null,
      seams: allSeams,
      otherOperations: [],
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

    const allRawData = await fetchWeldRawData(ipAddress, date as string | undefined);

    let filteredData = allRawData.filter((d) => {
      let matchIdentifier = false;
      if (partSerialId) {
        matchIdentifier = d.partSerialId === partSerialId;
      } else if (partItemNumber) {
        matchIdentifier = d.partItemNumber === partItemNumber;
      }

      if (jobName && d.jobName !== jobName) {
        return false;
      }

      return matchIdentifier;
    });

    filteredData = filteredData.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    let operationData: WeldRawData[] = [];

    if (operationIndex !== null && operationIndex !== undefined) {
      const targetIndex = parseInt(operationIndex as string);
      let currentOpIndex = 0;
      let currentOperation: WeldRawData[] = [];
      let currentSeamNumber: number | null = null;
      let currentDataPart: string | null = null;

      for (const data of filteredData) {
        const isNewOperation = currentSeamNumber === null || data.seamNumber !== currentSeamNumber || data.dataPart !== currentDataPart;

        if (isNewOperation) {
          if (currentOperation.length > 0) {
            if (currentOpIndex === targetIndex) {
              operationData = currentOperation;
              break;
            }
            currentOpIndex++;
          }
          currentOperation = [data];
          currentSeamNumber = data.seamNumber;
          currentDataPart = data.dataPart;
        } else {
          currentOperation.push(data);
        }
      }

      if (operationData.length === 0 && currentOpIndex === targetIndex) {
        operationData = currentOperation;
      }
    } else {
      operationData = filteredData.filter((d) => d.seamNumber === parseInt(seamNumber as string));
    }

    const actualData: WeldActualData[] = operationData.map((d) => ({
      date: d.date,
      time: d.time,
      actualVoltage: d.actualVoltage,
      actualCurrent: d.actualCurrent,
      actualWireSpeed: d.actualWireSpeed,
      torqueM1: d.torqueM1,
      torqueM2: d.torqueM2,
      actualGasFlow: d.actualGasFlow,
    }));

    return res.status(200).json({
      partSerialId: partSerialId || null,
      partItemNumber: partItemNumber || null,
      seamNumber: parseInt(seamNumber as string),
      operationIndex: operationIndex ? parseInt(operationIndex as string) : null,
      actualData,
    });
  } catch (error) {
    console.error("Error fetching actual data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { getWeldData, getWeldDates, getWeldSeams, getWeldActual };
