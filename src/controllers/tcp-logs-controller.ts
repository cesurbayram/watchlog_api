import { Request, Response } from "express";
import TCPEventModel from "../models/mongo/tcp-event.model";
import { compareTCPValues, calculateTCPStatistics } from "../services/tcp-parser.service";
import { TCPDataEntry, TCPLogsResponse } from "../models/tcp-event-dto";
import { dbPool } from "../config/db";

const mongoDocToTCPDataEntry = (doc: any): TCPDataEntry => ({
  index: doc.eventIndex,
  date: doc.eventDate ? doc.eventDate.toISOString() : "",
  event: doc.event || "",
  fileName: doc.fileName || "",
  elementNumber: doc.elementNumber || "",
  elementValue: doc.elementValue || "",
  parsedElement: doc.parsedElement || {},
  rawEntry: doc.rawEntry || "",
  controllerId: doc.controllerId,
  controllerName: doc.controllerName,
});

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

    const docs = await TCPEventModel.find({ controllerId })
      .sort({ eventDate: -1 })
      .lean();

    const tcpEvents: TCPDataEntry[] = docs.map(mongoDocToTCPDataEntry);
    const comparisons = compareTCPValues(tcpEvents);
    const statistics = calculateTCPStatistics(tcpEvents);

    const response: TCPLogsResponse = {
      success: true,
      events: tcpEvents,
      comparisons,
      statistics,
      controllerId,
      controllerName: controller.name,
      savedToDb: true,
      newEventsCount: 0,
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
    const docs = await TCPEventModel.find({})
      .sort({ eventDate: -1 })
      .lean();

    const allTCPEvents: TCPDataEntry[] = docs.map(mongoDocToTCPDataEntry);
    const comparisons = compareTCPValues(allTCPEvents);
    const statistics = calculateTCPStatistics(allTCPEvents);

    const response: TCPLogsResponse = {
      success: true,
      events: allTCPEvents,
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
      filter.eventDate = {};
      if (startDate) filter.eventDate.$gte = new Date(startDate as string);
      if (endDate) filter.eventDate.$lte = new Date(endDate as string);
    }

    if (toolNumber) {
      filter["parsedElement.actualToolNumber"] = parseInt(toolNumber as string, 10);
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    const [events, total] = await Promise.all([
      TCPEventModel.find(filter)
        .sort({ eventIndex: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean(),
      TCPEventModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      events: events.map(mongoDocToTCPDataEntry),
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

export const getTcpHistory = async (req: Request, res: Response) => {
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

    const stats = await TCPEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: "$eventDate" } },
          total_events: { $sum: 1 },
          tools_modified: { $addToSet: "$parsedElement.actualToolNumber" },
        },
      },
      {
        $project: {
          stat_date: "$_id",
          total_events: 1,
          tools_modified: { $size: "$tools_modified" },
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
    const summary = await TCPEventModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_events: { $sum: 1 },
          last_tcp_date: { $max: "$eventDate" },
          tools_modified: { $addToSet: "$parsedElement.actualToolNumber" },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_events: 1,
          last_tcp_date: 1,
          tools_modified: { $size: "$tools_modified" },
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
    const hasData = await TCPEventModel.exists({ controllerId });

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
