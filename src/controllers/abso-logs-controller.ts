import { Request, Response } from "express";
import AbsoSnapshotModel from "../models/mongo/abso-snapshot.model";
import { compareAbsoValues, calculateAbsoStatistics } from "../services/abso-parser.service";
import { AbsoluteDataEntry, AbsoLogsResponse } from "../models/abso-event-dto";
import { dbPool } from "../config/db";

const absoSnapshotToEntry = (doc: any): AbsoluteDataEntry => ({
  index: 0,
  date: doc.recordedAt ? doc.recordedAt.toISOString() : "",
  groupNumber: "",
  axisNumber: "",
  setValue: "",
  currValue: doc.currValue || { R1: {} },
  rawEntry: "",
  controllerId: doc.controllerId,
  controllerName: doc.controllerName,
});

export const getAbsoLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersAbso(req, res);
    }

    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];

    const snapshotDocs = await AbsoSnapshotModel.find({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    const absoEvents: AbsoluteDataEntry[] = snapshotDocs.map(absoSnapshotToEntry);
    const comparisons = compareAbsoValues(absoEvents);
    const statistics = calculateAbsoStatistics(absoEvents);

    const response: AbsoLogsResponse = {
      success: true,
      events: absoEvents,
      comparisons,
      statistics,
      controllerId,
      controllerName: controller.name,
      savedToDb: true,
      newEventsCount: 0,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching ABSO logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

const handleAllControllersAbso = async (req: Request, res: Response) => {
  try {
    const snapshotDocs = await AbsoSnapshotModel.find({})
      .sort({ recordedAt: -1 })
      .lean();

    const allAbsoEvents: AbsoluteDataEntry[] = snapshotDocs.map(absoSnapshotToEntry);
    const comparisons = compareAbsoValues(allAbsoEvents);
    const statistics = calculateAbsoStatistics(allAbsoEvents);

    const response: AbsoLogsResponse = {
      success: true,
      events: allAbsoEvents,
      comparisons,
      statistics,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating ABSO logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate ABSO logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      comparisons: [],
      statistics: null,
    });
  }
};

export const getAbsoEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, limit, offset } = req.query;

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

    const [snapshotDocs, total] = await Promise.all([
      AbsoSnapshotModel.find(filter)
        .sort({ recordedAt: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean(),
      AbsoSnapshotModel.countDocuments(filter),
    ]);

    const paginated = snapshotDocs.map(absoSnapshotToEntry);

    return res.status(200).json({
      success: true,
      events: paginated,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error fetching ABSO events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAbsoHistory = async (req: Request, res: Response) => {
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

    const stats = await AbsoSnapshotModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: "$recordedAt" } },
          total_events: { $sum: 1 },
          axis_changes: { $sum: 6 },
        },
      },
      { $project: { stat_date: "$_id", total_events: 1, axis_changes: 1 } },
      { $sort: { stat_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error fetching ABSO history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAllControllersAbsoSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await AbsoSnapshotModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_events: { $sum: 1 },
          last_abso_date: { $max: "$recordedAt" },
          axis_changes: { $sum: 6 },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_events: 1,
          last_abso_date: 1,
          axis_changes: 1,
        },
      },
      { $sort: { last_abso_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      controllers: summary,
    });
  } catch (error) {
    console.error("Error fetching ABSO summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch ABSO summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const checkAbsoData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await AbsoSnapshotModel.exists({ controllerId });

    return res.status(200).json({
      success: true,
      hasData: !!hasData,
    });
  } catch (error) {
    console.error("Error checking ABSO data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check ABSO data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
