import { Router } from "express";
import {
  getAbsoLogsByControllerId,
  getAbsoEventsFromDatabase,
  getAbsoHistory,
  getAllControllersAbsoSummaryEndpoint,
  checkAbsoData,
} from "../controllers/abso-logs-controller";

const absoLogsRouter = Router();

absoLogsRouter.get("/summary/all", getAllControllersAbsoSummaryEndpoint);
absoLogsRouter.get("/:controllerId", getAbsoLogsByControllerId);
absoLogsRouter.get("/:controllerId/events", getAbsoEventsFromDatabase);
absoLogsRouter.get("/:controllerId/history", getAbsoHistory);
absoLogsRouter.get("/:controllerId/check", checkAbsoData);

export default absoLogsRouter;
