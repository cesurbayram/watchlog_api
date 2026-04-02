import { Request, Response } from "express";
import mongoose from "mongoose";
import JobChangeEventModel from "../models/mongo/job-change-event.model";
import JobWatchTargetModel from "../models/mongo/job-watch-target.model";
import { JobChangeEventDto, JobLogsResponse } from "../models/job-event-dto";
import { dbPool } from "../config/db";
import { readJobFileContent, createSimpleDiff } from "../utils/job-file-utils";
import { runWatchedJobsFetch } from "../services/job-watch-fetch.service";

const docToJobChangeEventDto = (doc: any): JobChangeEventDto => ({
  id: doc._id.toString(),
  controllerId: doc.controllerId,
  controllerName: doc.controllerName,
  jobName: doc.jobName,
  detectedAt: doc.detectedAt ? doc.detectedAt.toISOString() : "",
  changeType: doc.changeType,
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
      const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
      if (startDate) {
        const s = startDate as string;
        filter.detectedAt.$gte = DATE_ONLY.test(s)
          ? new Date(`${s}T00:00:00.000Z`)
          : new Date(s);
      }
      if (endDate) {
        const e = endDate as string;
        if (DATE_ONLY.test(e)) {
          const end = new Date(`${e}T00:00:00.000Z`);
          end.setUTCHours(23, 59, 59, 999);
          filter.detectedAt.$lte = end;
        } else {
          filter.detectedAt.$lte = new Date(e);
        }
      }
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

type WatchTargetBody = { targets?: { controllerId: string; jobName: string }[] };

export const replaceJobWatchTargets = async (req: Request, res: Response) => {
  try {
    const { targets } = req.body as WatchTargetBody;
    if (!Array.isArray(targets)) {
      return res.status(400).json({ success: false, error: "targets[] is required" });
    }

    for (const t of targets) {
      if (!t?.controllerId || !t?.jobName) {
        return res.status(400).json({
          success: false,
          error: "Each target needs controllerId and jobName",
        });
      }
    }

    const seen = new Set<string>();
    const unique: { controllerId: string; jobName: string }[] = [];
    for (const t of targets) {
      const controllerId = String(t.controllerId).trim();
      const jobName = String(t.jobName).trim();
      const key = `${controllerId}:${jobName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ controllerId, jobName });
    }

    await JobWatchTargetModel.deleteMany({});
    if (unique.length > 0) {
      await JobWatchTargetModel.insertMany(unique);
    }

    return res.status(200).json({ success: true, count: unique.length });
  } catch (error) {
    console.error("Error replacing job watch targets:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to save watch targets: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const fetchJobWatchTargetsNow = async (_req: Request, res: Response) => {
  try {
    const result = await runWatchedJobsFetch();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching watched jobs:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch watched jobs: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const getJobLogEventDiffModal = async (req: Request, res: Response) => {
  const { eventId } = req.params;

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ success: false, error: "Invalid event id" });
  }

  try {
    const doc = await JobChangeEventModel.findById(eventId)
      .select("+previousContent +newContent +diff")
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const cq = await dbPool.query(`SELECT ip_address, name FROM controller WHERE id = $1`, [
      doc.controllerId,
    ]);
    const ip = cq.rows[0]?.ip_address as string | undefined;
    const diskContent =
      ip && typeof ip === "string" ? readJobFileContent(ip, doc.jobName) : null;

    const previousContent =
      typeof doc.previousContent === "string" ? doc.previousContent : "";
    const newContentAtEvent = typeof doc.newContent === "string" ? doc.newContent : "";
    const diffAtEvent = typeof doc.diff === "string" ? doc.diff : "";
    const diskStr = diskContent ?? "";

    const diffPreviousVsDisk = createSimpleDiff(previousContent, diskStr);

    return res.status(200).json({
      success: true,
      jobName: doc.jobName,
      controllerId: doc.controllerId,
      controllerName: cq.rows[0]?.name,
      changeType: doc.changeType,
      detectedAt: doc.detectedAt ? new Date(doc.detectedAt).toISOString() : "",
      previousContentFromMongo: previousContent,
      newContentAtEvent,
      diskContent: diskStr,
      diffAtEvent,
      diffPreviousVsDisk,
      fileMissing: ip ? diskStr.length === 0 : true,
    });
  } catch (error) {
    console.error("Error building job log diff modal:", error);
    return res.status(500).json({
      success: false,
      error: `Failed to load diff: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

