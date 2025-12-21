import { Router } from "express";
import { createRobot, deleteRobot, getRobotById, getRobots, updateRobot } from "../controllers/robot-controller";

const robotRouter = Router();

robotRouter.get("/", getRobots);
robotRouter.get("/:id", getRobotById);
robotRouter.post("/", createRobot);
robotRouter.put("/:id", updateRobot);
robotRouter.delete("/:id", deleteRobot);

export default robotRouter;
