import { Router } from "express";
import { createShift, deleteShift, getShiftById, getShifts, updateShift } from "../controllers/shift-controller";

const shiftRouter = Router();

shiftRouter.get("/", getShifts);
shiftRouter.get("/:id", getShiftById);
shiftRouter.post("/", createShift);
shiftRouter.put("/:id", updateShift);
shiftRouter.delete("/:id", deleteShift);

export default shiftRouter;
