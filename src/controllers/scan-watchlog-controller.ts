import { Request, Response } from "express";

export const scanAndProcessWatchlogFiles = async (req: Request, res: Response) => {
  try {
    const alarmPipeline = req.app.get("alarmDatPipeline");
    const absoPipeline = req.app.get("absoDatPipeline");
    const tcpPipeline = req.app.get("tcpDatPipeline");
    const jobPipeline = req.app.get("jobDatPipeline");
    const logPipeline = req.app.get("logPipeline");

    if (!alarmPipeline || !absoPipeline || !tcpPipeline || !jobPipeline || !logPipeline) {
      return res.status(503).json({
        success: false,
        error: "Pipelines not initialized",
      });
    }

    const [alarmResult, absoResult, tcpResult, jobResult, logResult] = await Promise.all([
      alarmPipeline.scanAndProcess(),
      absoPipeline.scanAndProcess(),
      tcpPipeline.scanAndProcess(),
      jobPipeline.scanAndProcess(),
      logPipeline.scanAndProcess(),
    ]);

    const totalScanned =
      alarmResult.scanned + absoResult.scanned + tcpResult.scanned + jobResult.scanned + logResult.scanned;
    const totalProcessed =
      alarmResult.processed + absoResult.processed + tcpResult.processed + jobResult.processed + logResult.processed;
    const allErrors = [
      ...alarmResult.errors,
      ...absoResult.errors,
      ...tcpResult.errors,
      ...jobResult.errors,
      ...logResult.errors,
    ];

    return res.status(200).json({
      success: true,
      alarm: alarmResult,
      abso: absoResult,
      tcp: tcpResult,
      job: jobResult,
      teaching: logResult,
      totalScanned,
      totalProcessed,
      errors: allErrors,
    });
  } catch (error) {
    console.error("[ScanWatchlog] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Scan failed",
    });
  }
};
