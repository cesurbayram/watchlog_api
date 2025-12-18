import { Router } from "express";
import { createCell, deleteCell, getCellById, getCells, updateCell } from "../controllers/cell-controller";

const cellRouter = Router();

cellRouter.get("/", getCells);
cellRouter.get("/:id", getCellById);
cellRouter.post("/", createCell);
cellRouter.put("/:id", updateCell);
cellRouter.delete("/:id", deleteCell);

export default cellRouter;
