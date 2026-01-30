import { Router } from "express";
import {
  getTeachingLogsByControllerId,
  getTeachingEventsFromDatabase,
  getTeachingHistory,
  getAllControllersSummaryEndpoint,
  getTeachingFileNames,
  checkTeachingData,
} from "../controllers/teaching-logs-controller";

const teachingLogsRouter = Router();

teachingLogsRouter.get("/summary/all", getAllControllersSummaryEndpoint);
teachingLogsRouter.get("/:controllerId", getTeachingLogsByControllerId);
teachingLogsRouter.get("/:controllerId/events", getTeachingEventsFromDatabase);
teachingLogsRouter.get("/:controllerId/history", getTeachingHistory);
teachingLogsRouter.get("/:controllerId/files", getTeachingFileNames);
teachingLogsRouter.get("/:controllerId/check", checkTeachingData);

export default teachingLogsRouter;
