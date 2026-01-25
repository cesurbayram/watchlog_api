import { Router } from "express";
import {
  getQuickAssist,
  getQuickAssistById,
  createQuickAssist,
  updateQuickAssist,
  deleteQuickAssistDocument,
  deleteQuickAssistCategory,
  downloadQuickAssistFile,
} from "../controllers/quick-assist-controller";

const quickAssistRouter = Router();

quickAssistRouter.get("/", getQuickAssist);
quickAssistRouter.post("/", createQuickAssist);
quickAssistRouter.delete("/", deleteQuickAssistCategory);

quickAssistRouter.get("/download/:filename", downloadQuickAssistFile);

quickAssistRouter.get("/:id", getQuickAssistById);
quickAssistRouter.put("/:id", updateQuickAssist);
quickAssistRouter.delete("/:id", deleteQuickAssistDocument);

export default quickAssistRouter;
