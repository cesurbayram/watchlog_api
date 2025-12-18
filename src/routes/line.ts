import { Router } from "express";
import { createLine, deleteLine, getLineById, getLines, updateLine } from "../controllers/line-controller";

const lineRouter = Router();

lineRouter.get("/", getLines);
lineRouter.get("/:id", getLineById);
lineRouter.post("/", createLine);
lineRouter.put("/:id", updateLine);
lineRouter.delete("/:id", deleteLine);

export default lineRouter;
