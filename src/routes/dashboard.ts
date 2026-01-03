import { Router } from "express";
import { getAlarmStats, getDashboardHierarchy, getDebug, getPerformance, getRecentAlarm, getStats } from "../controllers/dashboard-controller";

const dashboardRouter = Router();

dashboardRouter.get("/alarm-stats", getAlarmStats);
dashboardRouter.get("/debug", getDebug);
dashboardRouter.get("/performance", getPerformance);
dashboardRouter.get("/recent-alarms", getRecentAlarm);
dashboardRouter.get("/stats", getStats);
dashboardRouter.get("/home/hierarchy", getDashboardHierarchy);

export default dashboardRouter;
