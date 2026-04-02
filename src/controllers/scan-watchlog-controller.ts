import { Request, Response } from "express";

const VALID_SCOPES = ["alarm", "abso", "tcp", "job", "teach", "all"] as const;
type ScanScope = (typeof VALID_SCOPES)[number];

const ALL_KEYS: Exclude<ScanScope, "all">[] = [
  "alarm",
  "abso",
  "tcp",
  "job",
  "teach",
];

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

    const raw = req.body?.scope;
    const scope: ScanScope =
      typeof raw === "string" && VALID_SCOPES.includes(raw as ScanScope)
        ? (raw as ScanScope)
        : "all";

    const pipelines: Record<
      Exclude<ScanScope, "all">,
      { scanAndProcess: () => Promise<{ scanned: number; processed: number; errors: string[] }> }
    > = {
      alarm: alarmPipeline,
      abso: absoPipeline,
      tcp: tcpPipeline,
      job: jobPipeline,
      teach: logPipeline,
    };

    const keysToRun: Exclude<ScanScope, "all">[] =
      scope === "all" ? ALL_KEYS : [scope];

    const entries = await Promise.all(
      keysToRun.map(async (key) => {
        const r = await pipelines[key].scanAndProcess();
        return [key, r] as const;
      })
    );

    const breakdown: Record<string, { scanned: number; processed: number; errors: string[] }> =
      {};
    let totalScanned = 0;
    let totalProcessed = 0;
    const allErrors: string[] = [];

    for (const [key, r] of entries) {
      breakdown[key] = r;
      totalScanned += r.scanned;
      totalProcessed += r.processed;
      allErrors.push(...r.errors);
    }

    return res.status(200).json({
      success: true,
      scope,
      alarm: breakdown.alarm,
      abso: breakdown.abso,
      tcp: breakdown.tcp,
      job: breakdown.job,
      teaching: breakdown.teach,
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
