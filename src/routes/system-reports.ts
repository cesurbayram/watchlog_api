import { Router } from "express";
import { generateReport, getAvailableReportSections } from "../controllers/system-reports-controller";

const systemReportsRouter = Router();

systemReportsRouter.get("/sections", getAvailableReportSections);
systemReportsRouter.post("/generate", generateReport);

export default systemReportsRouter;
