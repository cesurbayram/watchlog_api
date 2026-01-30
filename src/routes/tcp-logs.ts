import { Router } from "express";
import {
  getTcpLogsByControllerId,
  getTcpEventsFromDatabase,
  getTcpHistory,
  getAllControllersTcpSummaryEndpoint,
  checkTcpData,
} from "../controllers/tcp-logs-controller";

const tcpLogsRouter = Router();

tcpLogsRouter.get("/summary/all", getAllControllersTcpSummaryEndpoint);
tcpLogsRouter.get("/:controllerId", getTcpLogsByControllerId);
tcpLogsRouter.get("/:controllerId/events", getTcpEventsFromDatabase);
tcpLogsRouter.get("/:controllerId/history", getTcpHistory);
tcpLogsRouter.get("/:controllerId/check", checkTcpData);

export default tcpLogsRouter;
