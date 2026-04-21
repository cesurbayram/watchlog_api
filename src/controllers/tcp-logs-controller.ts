import { Request, Response } from "express";
import TcpSnapshotModel from "../models/mongo/tcp-snapshot.model";
import { compareTCPValues, calculateTCPStatistics } from "../services/tcp-parser.service";
import { tcpSnapshotToDataEntries } from "../utils/tcp-snapshot-converter";
import { TCPDataEntry, TCPLogsResponse } from "../models/tcp-event-dto";
import { dbPool } from "../config/db";

export const getTcpLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersTCP(req, res);
    }

    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];

    const snapshots = await TcpSnapshotModel.find({ controllerId })
      .sort({ recordedAt: -1 })
      .limit(2)
      .lean();

    const allEntries: TCPDataEntry[] = [];
    for (const snap of snapshots) {
      allEntries.push(...tcpSnapshotToDataEntries(snap));
    }
    const sortedEntries = allEntries.sort(
      (a, b) =>
        a.elementNumber.localeCompare(b.elementNumber) ||
        b.date.localeCompare(a.date)
    );
    const comparisons = compareTCPValues(sortedEntries);
    const latestEntries = snapshots[0]
      ? tcpSnapshotToDataEntries(snapshots[0])
      : [];
    const statistics = calculateTCPStatistics(latestEntries);

    const latestSnapshot = snapshots[0]
      ? {
        tools: snapshots[0].tools,
        recordedAt: new Date(snapshots[0].recordedAt).toISOString(),
      }
      : undefined;
    const previousSnapshot = snapshots[1]
      ? {
        tools: snapshots[1].tools,
        recordedAt: new Date(snapshots[1].recordedAt).toISOString(),
      }
      : null;

    const response: TCPLogsResponse = {
      success: true,
      events: latestEntries,
      comparisons,
      statistics,
      controllerId,
      controllerName: controller.name,
      savedToDb: true,
      newEventsCount: 0,
      latestSnapshot,
      previousSnapshot,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching TCP logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

const handleAllControllersTCP = async (req: Request, res: Response) => {
  try {
    const snapshots = await TcpSnapshotModel.find({})
      .sort({ recordedAt: -1 })
      .lean();

    const allEntries: TCPDataEntry[] = [];
    const seenControllers = new Set<string>();
    for (const snap of snapshots) {
      if (seenControllers.has(snap.controllerId)) continue;
      seenControllers.add(snap.controllerId);
      allEntries.push(...tcpSnapshotToDataEntries(snap));
    }
    const sortedEntries = allEntries.sort(
      (a, b) =>
        (a.controllerId || "").localeCompare(b.controllerId || "") ||
        a.elementNumber.localeCompare(b.elementNumber) ||
        b.date.localeCompare(a.date)
    );
    const comparisons = compareTCPValues(sortedEntries);
    const statistics = calculateTCPStatistics(allEntries);

    const response: TCPLogsResponse = {
      success: true,
      events: allEntries,
      comparisons,
      statistics,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating TCP logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate TCP logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

export const getTcpEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, toolNumber, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const filter: any = { controllerId };

    if (startDate || endDate) {
      filter.recordedAt = {};
      if (startDate) filter.recordedAt.$gte = new Date(startDate as string);
      if (endDate) filter.recordedAt.$lte = new Date(endDate as string);
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    const [snapshots, total] = await Promise.all([
      TcpSnapshotModel.find(filter)
        .sort({ recordedAt: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean(),
      TcpSnapshotModel.countDocuments(filter),
    ]);

    const allEntries: TCPDataEntry[] = [];
    for (const snap of snapshots) {
      allEntries.push(...tcpSnapshotToDataEntries(snap));
    }
    if (toolNumber) {
      const tn = parseInt(toolNumber as string, 10);
      const filtered = allEntries.filter(
        (e) => e.parsedElement?.actualToolNumber === tn
      );
      return res.status(200).json({
        success: true,
        events: filtered,
        total: filtered.length,
        limit: limitNum,
        offset: offsetNum,
      });
    }

    return res.status(200).json({
      success: true,
      events: allEntries,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error fetching TCP events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getTcpSnapshotsInRange = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, dedupe } = req.query;
  const dedupeByDay = dedupe !== "false" && dedupe !== "0";

  if (!controllerId || controllerId === "all") {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  if (!startDate && !endDate) {
    return res
      .status(400)
      .json({ success: false, error: "Provide startDate and/or endDate (ISO yyyy-MM-dd)" });
  }

  try {
    const filter: Record<string, unknown> = { controllerId };
    const range: Record<string, Date> = {};
    if (startDate) range.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    if (Object.keys(range).length > 0) {
      filter.recordedAt = range;
    }

    const raw = await TcpSnapshotModel.find(filter).sort({ recordedAt: -1 }).lean();

    const toSnapshot = (doc: (typeof raw)[number]) => ({
      tools: doc.tools,
      recordedAt: new Date(doc.recordedAt).toISOString(),
    });

    const snapshots = dedupeByDay
      ? (() => {
          const byDay = new Map<string, (typeof raw)[number]>();
          for (const doc of raw) {
            const key = new Date(doc.recordedAt).toISOString().slice(0, 10);
            if (!byDay.has(key)) byDay.set(key, doc);
          }
          return Array.from(byDay.values())
            .map(toSnapshot)
            .sort(
              (a, b) =>
                new Date(a.recordedAt).getTime() -
                new Date(b.recordedAt).getTime()
            );
        })()
      : [...raw]
          .map(toSnapshot)
          .sort(
            (a, b) =>
              new Date(a.recordedAt).getTime() -
              new Date(b.recordedAt).getTime()
          );

    return res.status(200).json({ success: true, snapshots });
  } catch (error) {
    console.error("Error fetching TCP snapshots in range:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP snapshots: ${error instanceof Error ? error.message : "Unknown error"
        }`,
    });
  }
};

export const getTcpHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const matchStage: any = { controllerId };

    if (startDate || endDate) {
      matchStage.recordedAt = {};
      if (startDate) matchStage.recordedAt.$gte = new Date(startDate as string);
      if (endDate) matchStage.recordedAt.$lte = new Date(endDate as string);
    }

    let dateGroupFormat: string;
    switch (groupBy) {
      case "week":
        dateGroupFormat = "%Y-W%V";
        break;
      case "month":
        dateGroupFormat = "%Y-%m";
        break;
      default:
        dateGroupFormat = "%Y-%m-%d";
    }

    const stats = await TcpSnapshotModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: "$recordedAt" } },
          total_events: { $sum: 1 },
          tools_modified: { $sum: { $size: "$tools" } },
        },
      },
      {
        $project: {
          stat_date: "$_id",
          total_events: 1,
          tools_modified: 1,
        },
      },
      { $sort: { stat_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error fetching TCP history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAllControllersTcpSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await TcpSnapshotModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_events: { $sum: 1 },
          last_tcp_date: { $max: "$recordedAt" },
          tools_modified: { $sum: { $size: "$tools" } },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_events: 1,
          last_tcp_date: 1,
          tools_modified: 1,
        },
      },
      { $sort: { last_tcp_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      controllers: summary,
    });
  } catch (error) {
    console.error("Error fetching TCP summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch TCP summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const checkTcpData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await TcpSnapshotModel.exists({ controllerId });

    return res.status(200).json({
      success: true,
      hasData: !!hasData,
    });
  } catch (error) {
    console.error("Error checking TCP data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check TCP data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
