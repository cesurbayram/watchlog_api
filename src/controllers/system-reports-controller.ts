import { Request, Response } from "express";
import { collectAlarmReportData } from "../utils/collectors/alarm-report-collector.js";
import { collectOperatingRateReportData } from "../utils/collectors/operating-rate-collector.js";
import { collectUtilizationReportData } from "../utils/collectors/utilization-report-collector.js";
import { collectSystemHealthData } from "../utils/collectors/system-health-collector.js";

const getAlarmReport = async (req: Request, res: Response) => {
  try {
    const { controllerIds, timeRange = "7d", shiftId } = req.query;

    const parsedControllerIds = controllerIds ? (controllerIds as string).split(",") : undefined;

    const data = await collectAlarmReportData(parsedControllerIds, timeRange as "24h" | "7d" | "shift", shiftId as string);

    return res.json(data);
  } catch (error: any) {
    console.error("Error generating alarm report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate alarm report",
      details: error.message,
    });
  }
};

const getUtilizationReport = async (req: Request, res: Response) => {
  try {
    const { controllerIds, timeRange = "7d", shiftId } = req.query;

    const parsedControllerIds = controllerIds ? (controllerIds as string).split(",") : undefined;

    const data = await collectUtilizationReportData(parsedControllerIds, timeRange as "24h" | "7d" | "shift", shiftId as string);

    return res.json(data);
  } catch (error: any) {
    console.error("Error generating utilization report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate utilization report",
      details: error.message,
    });
  }
};

const getOperatingRateReport = async (req: Request, res: Response) => {
  try {
    const { controllerIds, timeRange = "7d", shiftId } = req.query;

    const parsedControllerIds = controllerIds ? (controllerIds as string).split(",") : undefined;

    const data = await collectOperatingRateReportData(parsedControllerIds, timeRange as "24h" | "7d" | "shift", shiftId as string);

    return res.json(data);
  } catch (error: any) {
    console.error("Error generating operating rate report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate operating rate report",
      details: error.message,
    });
  }
};

const getSystemHealthReport = async (req: Request, res: Response) => {
  try {
    const { controllerIds, timeRange = "7d", shiftId } = req.query;

    const parsedControllerIds = controllerIds ? (controllerIds as string).split(",") : undefined;

    const data = await collectSystemHealthData(parsedControllerIds, timeRange as "24h" | "7d" | "shift", shiftId as string);

    return res.json(data);
  } catch (error: any) {
    console.error("Error generating system health report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate system health report",
      details: error.message,
    });
  }
};

export { getAlarmReport, getUtilizationReport, getOperatingRateReport, getSystemHealthReport };
