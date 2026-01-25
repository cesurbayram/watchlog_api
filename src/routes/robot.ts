import { Router } from "express";
import {
  createRobot,
  deleteRobot,
  getAbsoDataWithControllerId,
  getAlarmsWithTypeByControllerId,
  getRobotById,
  getRobots,
  getStatus,
  getStatusHistory,
  updateRobot,
} from "../controllers/robot-controller";
import { getUtilizationByControllerId } from "../controllers/utilzation-controller";
import { saveComparison, getComparisonHistory, getComparisonById, deleteComparison } from "../controllers/teaching-controller";
import { getBackupPlans, createBackupPlan, updateBackupPlan, deleteBackupPlan } from "../controllers/backup-plan-controller";
import { getTorkData, clearTorkData } from "../controllers/tork-controller";
import { getJobsByControllerId } from "../controllers/job-controller";

const robotRouter = Router();

robotRouter.get("/", getRobots);
robotRouter.post("/", createRobot);

robotRouter.get("/status-history", getStatusHistory);
robotRouter.get("/status", getStatus);

robotRouter.get("/:id", getRobotById);
robotRouter.put("/:id", updateRobot);
robotRouter.delete("/:id", deleteRobot);
robotRouter.get("/:controllerId/alarms/:types", getAlarmsWithTypeByControllerId);
robotRouter.get("/:controllerId/data/absodat", getAbsoDataWithControllerId);
robotRouter.get("/:controllerId/utilization", getUtilizationByControllerId);

robotRouter.post("/:controllerId/teaching/compare", saveComparison);
robotRouter.get("/:controllerId/teaching/history", getComparisonHistory);
robotRouter.get("/:controllerId/teaching/compare/:comparisonId", getComparisonById);
robotRouter.delete("/:controllerId/teaching/compare", deleteComparison);

robotRouter.get("/:controllerId/files/backup/plans", getBackupPlans);
robotRouter.post("/:controllerId/files/backup/plans", createBackupPlan);
robotRouter.put("/:controllerId/files/backup/plans/:planId", updateBackupPlan);
robotRouter.delete("/:controllerId/files/backup/plans/:planId", deleteBackupPlan);

robotRouter.get("/:controllerId/monitoring/tork", getTorkData);
robotRouter.delete("/:controllerId/monitoring/tork", clearTorkData);
robotRouter.delete("/:controllerId/monitoring/tork/clear", clearTorkData);

robotRouter.get("/:controllerId/jobs", getJobsByControllerId);

export default robotRouter;
