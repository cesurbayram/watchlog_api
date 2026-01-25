import { Router } from "express";
import { getJobFileContent } from "../controllers/job-file-content-controller";

const jobFileContentRouter = Router();

jobFileContentRouter.get("/:controllerId/:jobName", getJobFileContent);

export default jobFileContentRouter;
