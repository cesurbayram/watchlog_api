import { Router } from "express";
import { getJobById, getJobFileContent, getJobs } from "../controllers/job-controller";

const jobRouter = Router();

jobRouter.get("/job-file-content/:controllerId/:jobName", getJobFileContent);
jobRouter.get("/", getJobs);
jobRouter.get("/:jobId", getJobById);

export default jobRouter;
