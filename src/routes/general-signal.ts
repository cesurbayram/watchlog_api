import { Router } from "express";
import { createGeneralSignal, deleteGeneralSignal, getGeneralSignals } from "../controllers/general-signal-controller";

const generalSignalRouter = Router();

generalSignalRouter.get("/:controllerId", getGeneralSignals);
generalSignalRouter.post("/:controllerId", createGeneralSignal);
generalSignalRouter.delete("/:controllerId", deleteGeneralSignal);

export default generalSignalRouter;
