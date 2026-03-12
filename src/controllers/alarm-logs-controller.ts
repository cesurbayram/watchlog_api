import { Request, Response } from "express";
import AlarmSnapshotModel from "../models/mongo/alarm-snapshot.model";
import { dbPool } from "../config/db";
import {
  alarmSnapshotToHistoryItems,
  SystemAlarmHistoryItem,
  SystemAlarmType,
} from "../utils/alarm-snapshot-converter";

export const getAlarmLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { type } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersAlarm(req, res);
    }

    const controllerResult = await dbPool.query(
      `SELECT id, ip_address, name FROM controller WHERE id = $1`,
      [controllerId]
    );

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const snapshot = await AlarmSnapshotModel.findOne({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    const filterType = type ? (type as SystemAlarmType) : undefined;
    const events = alarmSnapshotToHistoryItems(snapshot || {}, filterType);

    return res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching alarm logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch alarm logs: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

function parseOriginDate(originDate: string): number {
  if (!originDate) return 0;
  const normalized = originDate.replace(/\//g, "-");
  return new Date(normalized).getTime();
}

const handleAllControllersAlarm = async (req: Request, res: Response) => {
  const {
    type,
    types,
    controllerIds,
    search,
    dateFrom,
    dateTo,
    page: pageParam,
    pageSize: pageSizeParam,
  } = req.query;

  try {
    const snapshots = await AlarmSnapshotModel.find({})
      .sort({ recordedAt: -1 })
      .lean();

    const seenControllers = new Set<string>();
    const allItems: SystemAlarmHistoryItem[] = [];

    const typeStr = (type as string) || (types as string);
    const filterTypes: SystemAlarmType[] = typeStr
      ? (typeStr.includes(",") ? typeStr.split(",") : [typeStr])
          .map((s) => s.trim())
          .filter(Boolean) as SystemAlarmType[]
      : [];

    const controllerIdsStr = controllerIds as string;
    const filterControllerIds =
      controllerIdsStr && controllerIdsStr !== "all"
        ? new Set(
            controllerIdsStr
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        : null;

    for (const snap of snapshots) {
      if (seenControllers.has(snap.controllerId)) continue;
      if (filterControllerIds && !filterControllerIds.has(snap.controllerId)) continue;
      seenControllers.add(snap.controllerId);
      const filterType = filterTypes.length > 0 ? undefined : (type as SystemAlarmType) || undefined;
      const items = alarmSnapshotToHistoryItems(snap, filterType);
      for (const item of items) {
        if (filterTypes.length > 0 && !filterTypes.includes(item.type)) continue;
        allItems.push(item);
      }
    }

    let filtered = allItems.sort(
      (a, b) => parseOriginDate(b.originDate) - parseOriginDate(a.originDate)
    );

    if (search && typeof search === "string") {
      const s = search.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          (a.code || "").toLowerCase().includes(s) ||
          (a.name || "").toLowerCase().includes(s) ||
          (a.type || "").toLowerCase().includes(s) ||
          (a.mode || "").toLowerCase().includes(s)
      );
    }

    if (dateFrom && typeof dateFrom === "string") {
      const from = new Date(dateFrom).getTime();
      filtered = filtered.filter((a) => parseOriginDate(a.originDate) >= from);
    }
    if (dateTo && typeof dateTo === "string") {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((a) => parseOriginDate(a.originDate) <= to.getTime());
    }

    const countsByType: Record<string, number> = { MAJOR: 0, MINOR: 0, USER: 0, SYSTEM: 0 };
    filtered.forEach((a) => {
      if (a.type in countsByType) countsByType[a.type]++;
    });

    const page = Math.max(1, parseInt(pageParam as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam as string) || 10));
    const skip = (page - 1) * pageSize;
    const sliced = filtered.slice(skip, skip + pageSize);
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return res.status(200).json({
      alarms: sliced,
      total,
      countsByType,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error aggregating alarm logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate alarm logs: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAlarmEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, type, limit, offset } = req.query;

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

    const snapshots = await AlarmSnapshotModel.find(filter)
      .sort({ recordedAt: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .lean();

    const allItems: SystemAlarmHistoryItem[] = [];
    for (const snap of snapshots) {
      const filterType = type ? (type as SystemAlarmType) : undefined;
      allItems.push(...alarmSnapshotToHistoryItems(snap, filterType));
    }

    const total = await AlarmSnapshotModel.countDocuments(filter);

    return res.status(200).json({
      success: true,
      events: allItems,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error fetching alarm events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch alarm events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const checkAlarmData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await AlarmSnapshotModel.exists({ controllerId });

    return res.status(200).json({
      success: true,
      hasData: !!hasData,
    });
  } catch (error) {
    console.error("Error checking alarm data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check alarm data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAllControllersAlarmSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await AlarmSnapshotModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_snapshots: { $sum: 1 },
          last_alarm_date: { $max: "$recordedAt" },
          total_alarms: { $sum: 1 },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_snapshots: 1,
          last_alarm_date: 1,
          total_alarms: 1,
        },
      },
      { $sort: { last_alarm_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      controllers: summary,
    });
  } catch (error) {
    console.error("Error fetching alarm summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch alarm summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
