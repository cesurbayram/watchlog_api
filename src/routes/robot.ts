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

const robotRouter = Router();

robotRouter.get("/", getRobots);
robotRouter.get("/:id", getRobotById);
robotRouter.post("/", createRobot);
robotRouter.put("/:id", updateRobot);
robotRouter.delete("/:id", deleteRobot);

robotRouter.get("/status-history", getStatusHistory);
robotRouter.get("/status", getStatus);
robotRouter.get("/:controllerId/alarms/:types", getAlarmsWithTypeByControllerId);
robotRouter.get("/:controllerId/data/absodat", getAbsoDataWithControllerId);

export default robotRouter;
