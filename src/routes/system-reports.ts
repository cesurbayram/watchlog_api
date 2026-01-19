import { Router } from "express";
import { getAlarmReport, getUtilizationReport, getOperatingRateReport, getSystemHealthReport } from "../controllers/system-reports-controller";

const systemReportsRouter = Router();

systemReportsRouter.get("/alarm-report", getAlarmReport);
systemReportsRouter.get("/utilization-report", getUtilizationReport);
systemReportsRouter.get("/operating-rate-report", getOperatingRateReport);
systemReportsRouter.get("/system-health-report", getSystemHealthReport);

export default systemReportsRouter;
