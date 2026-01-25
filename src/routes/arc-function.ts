import { Router } from "express";
import { getArcFunctions, getArcFunctionById, createArcFunction, updateArcFunction, deleteArcFunction } from "../controllers/arc-function-controller";

const arcFunctionRouter = Router();

arcFunctionRouter.get("/", getArcFunctions);
arcFunctionRouter.get("/:id", getArcFunctionById);
arcFunctionRouter.post("/", createArcFunction);
arcFunctionRouter.put("/:id", updateArcFunction);
arcFunctionRouter.delete("/:id", deleteArcFunction);

export default arcFunctionRouter;
