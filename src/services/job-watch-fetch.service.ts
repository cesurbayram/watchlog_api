import JobWatchTargetModel from "../models/mongo/job-watch-target.model";
import { motoFetchFile } from "../utils/moto-client";

export async function runWatchedJobsFetch(): Promise<{
  fetched: number;
  failed: number;
  errors: string[];
}> {
  const targets = await JobWatchTargetModel.find({}).lean();
  const errors: string[] = [];
  let fetched = 0;
  let failed = 0;

  for (const t of targets) {
    const r = await motoFetchFile(t.controllerId, `${t.jobName}.JBI`);
    if (r.success) {
      fetched++;
    } else {
      failed++;
      errors.push(`${t.controllerId}/${t.jobName}: ${r.error || "fetch failed"}`);
    }
    await new Promise((res) => setTimeout(res, 400));
  }

  return { fetched, failed, errors };
}
