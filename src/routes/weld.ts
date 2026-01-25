import { Router } from "express";
import { getWeldData, getWeldDates, getWeldSeams, getWeldActual } from "../controllers/weld-controller";

const weldRouter = Router();

weldRouter.get("/:arcFunctionId", getWeldData);
weldRouter.get("/:arcFunctionId/dates", getWeldDates);
weldRouter.get("/:arcFunctionId/seams", getWeldSeams);
weldRouter.get("/:arcFunctionId/actual", getWeldActual);

export default weldRouter;
