import { Request, Response } from "express";
import JobChangeEventModel from "../models/mongo/job-change-event.model";
import { JobChangeEventDto, JobLogsResponse } from "../models/job-event-dto";
import { dbPool } from "../config/db";

const docToJobChangeEventDto = (doc: any): JobChangeEventDto => ({
  id: doc._id.toString(),
  controllerId: doc.controllerId,
  controllerName: doc.controllerName,
  jobName: doc.jobName,
  detectedAt: doc.detectedAt ? doc.detectedAt.toISOString() : "",
  changeType: doc.changeType,
  diff: doc.diff,
  previousContentHash: doc.previousContentHash,
  newContentHash: doc.newContentHash,
});

export const getJobLogsByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { limit = "50" } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    if (controllerId === "all") {
      return await handleAllControllersJobLogs(req, res);
    }

    const controllerQuery = `SELECT id, ip_address, name FROM controller WHERE id = $1`;
    const controllerResult = await dbPool.query(controllerQuery, [controllerId]);

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Controller not found" });
    }

    const controller = controllerResult.rows[0];
    const limitNum = parseInt(limit as string, 10) || 50;

    const docs = await JobChangeEventModel.find({ controllerId })
      .sort({ detectedAt: -1 })
      .limit(limitNum)
      .lean();

    const events: JobChangeEventDto[] = docs.map(docToJobChangeEventDto);

    const response: JobLogsResponse = {
      success: true,
      events,
      controllerId,
      controllerName: controller.name,
      total: events.length,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching Job logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch Job logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
    });
  }
};

const handleAllControllersJobLogs = async (req: Request, res: Response) => {
  const { limit = "50" } = req.query;
  const limitNum = parseInt(limit as string, 10) || 50;

  try {
    const docs = await JobChangeEventModel.find({})
      .sort({ detectedAt: -1 })
      .limit(limitNum)
      .lean();

    const events: JobChangeEventDto[] = docs.map(docToJobChangeEventDto);

    return res.status(200).json({
      success: true,
      events,
      total: events.length,
    });
  } catch (error) {
    console.error("Error aggregating Job logs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to aggregate Job logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      events: [],
    });
  }
};

export const getJobEventsFromDatabase = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, jobName, limit, offset } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const filter: any = { controllerId };

    if (startDate || endDate) {
      filter.detectedAt = {};
      if (startDate) filter.detectedAt.$gte = new Date(startDate as string);
      if (endDate) filter.detectedAt.$lte = new Date(endDate as string);
    }

    if (jobName) {
      filter.jobName = jobName;
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    const [docs, total] = await Promise.all([
      JobChangeEventModel.find(filter)
        .sort({ detectedAt: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean(),
      JobChangeEventModel.countDocuments(filter),
    ]);

    const events = docs.map(docToJobChangeEventDto);

    return res.status(200).json({
      success: true,
      events,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error("Error fetching Job events from DB:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch Job events: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getJobHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { startDate, endDate, groupBy } = req.query;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const matchStage: any = { controllerId };

    if (startDate || endDate) {
      matchStage.detectedAt = {};
      if (startDate) matchStage.detectedAt.$gte = new Date(startDate as string);
      if (endDate) matchStage.detectedAt.$lte = new Date(endDate as string);
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

    const stats = await JobChangeEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: "$detectedAt" } },
          total_changes: { $sum: 1 },
          modified: { $sum: { $cond: [{ $eq: ["$changeType", "modified"] }, 1, 0] } },
          added: { $sum: { $cond: [{ $eq: ["$changeType", "added"] }, 1, 0] } },
          deleted: { $sum: { $cond: [{ $eq: ["$changeType", "deleted"] }, 1, 0] } },
        },
      },
      {
        $project: {
          stat_date: "$_id",
          total_changes: 1,
          modified: 1,
          added: 1,
          deleted: 1,
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
    console.error("Error fetching Job history:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch Job history: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getJobLogsSummary = async (req: Request, res: Response) => {
  try {
    const summary = await JobChangeEventModel.aggregate([
      {
        $group: {
          _id: "$controllerId",
          controllerName: { $first: "$controllerName" },
          total_changes: { $sum: 1 },
          last_change_date: { $max: "$detectedAt" },
        },
      },
      {
        $project: {
          controller_id: "$_id",
          controller_name: "$controllerName",
          total_changes: 1,
          last_change_date: 1,
        },
      },
      { $sort: { last_change_date: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      controllers: summary,
      total: summary.length,
    });
  } catch (error) {
    console.error("Error fetching Job summary:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch Job summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const checkJobData = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  if (!controllerId) {
    return res.status(400).json({ success: false, error: "Controller ID is required" });
  }

  try {
    const hasData = await JobChangeEventModel.exists({ controllerId });

    return res.status(200).json({
      success: true,
      hasData: !!hasData,
      controllerId,
    });
  } catch (error) {
    console.error("Error checking Job data:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to check Job data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const triggerJobMonitoringRun = async (req: Request, res: Response) => {
  try {
    const jobPipeline = req.app.get("jobDatPipeline");
    if (!jobPipeline) {
      return res.status(503).json({
        success: false,
        error: "Job pipeline not initialized",
      });
    }
    const result = await jobPipeline.scanAndProcess();
    return res.status(200).json({
      success: true,
      scanned: result.scanned,
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error triggering job scan:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to run job scan: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

