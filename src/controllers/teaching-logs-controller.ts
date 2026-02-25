import { Request, Response } from "express";
import TeachingEventModel from "../models/mongo/teaching-event.model";
import { calculateTeachingStatistics } from "../services/teaching-parser.service";
import { TeachingEvent, TeachingLogsResponse } from "../models/teaching-event-dto";
import { dbPool } from "../config/db";

const mongoDocToTeachingEvent = (doc: any): TeachingEvent => ({
  index: doc.eventIndex,
  date: doc.eventDate ? doc.eventDate.toISOString() : "",
  type: doc.eventType,
  fileName: doc.fileName,
  lineNumber: doc.lineNumber,
  details: doc.details || "",
  rawEntry: doc.rawEntry || "",
  controllerId: doc.controllerId,
  controllerName: doc.controllerName,
});

export const getTeachingLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersTeaching(req, res);
    }

    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];

    const docs = await TeachingEventModel.find({ controllerId })
      .sort({ eventIndex: 1 })
      .lean();

    const teachingEvents: TeachingEvent[] = docs.map(mongoDocToTeachingEvent);
    const statistics = calculateTeachingStatistics(teachingEvents);

    const response: TeachingLogsResponse = {
      success: true,
      events: teachingEvents,
      statistics,
      controllerId,
      controllerName: controller.name,
      savedToDb: true,
      newEventsCount: 0,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching teaching logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch teaching logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      statistics: null,
    });
  }
};

const handleAllControllersTeaching = async (req: Request, res: Response) => {
  try {
    const docs = await TeachingEventModel.find({})
      .sort({ eventIndex: 1 })
      .lean();

    const allTeachingEvents: TeachingEvent[] = docs.map(mongoDocToTeachingEvent);
    const statistics = calculateTeachingStatistics(allTeachingEvents);

    const response: TeachingLogsResponse = {
      success: true,
      events: allTeachingEvents,
      statistics,
      savedToDb: true,
      newEventsCount: 0,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error aggregating teaching logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate teaching logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
      statistics: null,
    });
  }
};

export const getTeachingEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, eventType, fileName, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await getAllControllersSummaryEndpoint(req, res);
    }

    const filter: any = { controllerId };

    if (startDate || endDate) {
      filter.eventDate = {};
      if (startDate) filter.eventDate.$gte = new Date(startDate as string);
      if (endDate) filter.eventDate.$lte = new Date(endDate as string);
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    if (fileName) {
      filter.fileName = fileName;
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    const [events, total] = await Promise.all([
      TeachingEventModel.find(filter)
        .sort({ eventIndex: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean(),
      TeachingEventModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      events: events.map(mongoDocToTeachingEvent),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error getting teaching events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get teaching events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getTeachingHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const matchStage: any = { controllerId };

    if (startDate || endDate) {
      matchStage.eventDate = {};
      if (startDate) matchStage.eventDate.$gte = new Date(startDate as string);
      if (endDate) matchStage.eventDate.$lte = new Date(endDate as string);
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

    const stats = await TeachingEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: "$eventDate" } },
          point_modifications: {
            $sum: { $cond: [{ $eq: ["$eventType", "POINT_MODIFICATION"] }, 1, 0] },
          },
          instruction_inserts: {
            $sum: { $cond: [{ $eq: ["$eventType", "INSTRUCTION_INSERT"] }, 1, 0] },
          },
          instruction_deletes: {
            $sum: { $cond: [{ $eq: ["$eventType", "INSTRUCTION_DELETE"] }, 1, 0] },
          },
          teach_mode_activations: {
            $sum: { $cond: [{ $eq: ["$eventType", "TEACH_MODE"] }, 1, 0] },
          },
          total_events: { $sum: 1 },
        },
      },
      {
        $project: {
          stat_date: "$_id",
          point_modifications: 1,
          instruction_inserts: 1,
          instruction_deletes: 1,
          teach_mode_activations: 1,
          total_events: 1,
        },
      },
      { $sort: { stat_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      statistics: stats,
      controllerId,
      groupBy: groupBy || "day",
    });
  } catch (error) {
    console.error("Error getting teaching history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get teaching history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getAllControllersSummaryEndpoint = async (req: Request, res: Response) => {
  try {
    const summary = await TeachingEventModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_events: { $sum: 1 },
          last_teaching_date: { $max: "$eventDate" },
          point_modifications: {
            $sum: { $cond: [{ $eq: ["$eventType", "POINT_MODIFICATION"] }, 1, 0] },
          },
          instruction_inserts: {
            $sum: { $cond: [{ $eq: ["$eventType", "INSTRUCTION_INSERT"] }, 1, 0] },
          },
          instruction_deletes: {
            $sum: { $cond: [{ $eq: ["$eventType", "INSTRUCTION_DELETE"] }, 1, 0] },
          },
          teach_mode_activations: {
            $sum: { $cond: [{ $eq: ["$eventType", "TEACH_MODE"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_events: 1,
          last_teaching_date: 1,
          point_modifications: 1,
          instruction_inserts: 1,
          instruction_deletes: 1,
          teach_mode_activations: 1,
        },
      },
      { $sort: { last_teaching_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      controllers: summary,
      total: summary.length,
    });
  } catch (error) {
    console.error("Error getting controllers summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get controllers summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getTeachingFileNames = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const fileNames = await TeachingEventModel.distinct("fileName", {
      controllerId,
      fileName: { $ne: null },
    });

    return res.status(200).json({
      success: true,
      fileNames: fileNames.sort(),
    });
  } catch (error) {
    console.error("Error getting file names:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to get file names: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const checkTeachingData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await TeachingEventModel.exists({ controllerId });

    return res.status(200).json({
      success: true,
      hasData: !!hasData,
      controllerId,
    });
  } catch (error) {
    console.error("Error checking teaching data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check teaching data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
