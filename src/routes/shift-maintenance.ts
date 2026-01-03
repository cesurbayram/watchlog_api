import { Router } from "express";
import {
  createShiftMaintenance,
  deleteShiftMaintenance,
  getShiftMaintenanceController,
  getShiftMaintenanceHistory,
  updateShiftMaintenance,
} from "../controllers/shift-maintenance-controller";

const shiftMaintenanceRouter = Router();

shiftMaintenanceRouter.post("/", createShiftMaintenance);
shiftMaintenanceRouter.delete("/:id", deleteShiftMaintenance);
shiftMaintenanceRouter.put("/:id", updateShiftMaintenance);
shiftMaintenanceRouter.get("/controllers", getShiftMaintenanceController);
shiftMaintenanceRouter.get("/history", getShiftMaintenanceHistory);

export default shiftMaintenanceRouter;
