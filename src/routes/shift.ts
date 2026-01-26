import { Router } from "express";
import { createShift, deleteShift, getShiftById, getShifts, updateShift } from "../controllers/shift-controller";
import { generateReport } from "../controllers/report-controller";

const shiftRouter = Router();

shiftRouter.get("/", getShifts);
shiftRouter.get("/:id", getShiftById);
shiftRouter.post("/", createShift);
shiftRouter.put("/:id", updateShift);
shiftRouter.delete("/:id", deleteShift);

shiftRouter.post("/reports/generate", generateReport);

export default shiftRouter;
