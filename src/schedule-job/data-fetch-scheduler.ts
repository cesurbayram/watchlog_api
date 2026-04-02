import { dbPool } from "../config/db";
import { motoFetchFile } from "../utils/moto-client";

type TaskType = "job" | "tcp" | "abso" | "alarm" | "teach";

const runningFlags: Record<TaskType, boolean> = {
  job: false,
  tcp: false,
  abso: false,
  alarm: false,
  teach: false,
};

function canStart(task: TaskType): boolean {
  if (runningFlags[task]) return false;
  runningFlags[task] = true;
  return true;
}

function markDone(task: TaskType): void {
  runningFlags[task] = false;
}

async function getControllers(): Promise<{ id: string }[]> {
  const res = await dbPool.query(
    `SELECT id FROM controller WHERE ip_address IS NOT NULL AND ip_address != ''`
  );
  return res.rows;
}

async function getJobsByController(controllerId: string): Promise<{ name: string }[]> {
  const res = await dbPool.query(
    `SELECT name FROM job_select WHERE controller_id = $1 ORDER BY name`,
    [controllerId]
  );
  return res.rows;
}

async function updateLastRunAt(type: string): Promise<void> {
  await dbPool.query(
    `UPDATE data_fetch_schedule SET last_run_at = NOW(), updated_at = NOW() WHERE type = $1`,
    [type]
  );
}

export async function runJobFetch(): Promise<void> {
  if (!canStart("job")) {
    console.log("[DataFetch] Job fetch skipped - previous run still active");
    return;
  }
  try {
    const controllers = await getControllers();
    let totalFetched = 0;
    for (const c of controllers) {
      const jobs = await getJobsByController(c.id);
      for (const j of jobs) {
        const fileName = `${j.name}.JBI`;
        const result = await motoFetchFile(c.id, fileName);
        if (result.success) totalFetched++;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    await updateLastRunAt("job");
    // console.log(`[DataFetch] Job fetch done: ${controllers.length} controllers, ${totalFetched} jobs`);
  } catch (e) {
    console.error("[DataFetch] Job fetch error:", e);
  } finally {
    markDone("job");
  }
}

export async function runTcpFetch(): Promise<void> {
  if (!canStart("tcp")) return;
  try {
    const controllers = await getControllers();
    for (const c of controllers) {
      await motoFetchFile(c.id, "TOOL.CND");
      await new Promise((r) => setTimeout(r, 300));
    }
    await updateLastRunAt("tcp");
    // console.log(`[DataFetch] TCP fetch done: ${controllers.length} controllers`);
  } catch (e) {
    console.error("[DataFetch] TCP fetch error:", e);
  } finally {
    markDone("tcp");
  }
}

export async function runAbsoFetch(): Promise<void> {
  if (!canStart("abso")) return;
  try {
    const controllers = await getControllers();
    for (const c of controllers) {
      await motoFetchFile(c.id, "ABSO.DAT");
      await new Promise((r) => setTimeout(r, 300));
    }
    await updateLastRunAt("abso");
    // console.log(`[DataFetch] Abso fetch done: ${controllers.length} controllers`);
  } catch (e) {
    console.error("[DataFetch] Abso fetch error:", e);
  } finally {
    markDone("abso");
  }
}

export async function runAlarmFetch(): Promise<void> {
  if (!canStart("alarm")) return;
  try {
    const controllers = await getControllers();
    for (const c of controllers) {
      await motoFetchFile(c.id, "ALMHIST.DAT");
      await new Promise((r) => setTimeout(r, 300));
    }
    await updateLastRunAt("alarm");
    // console.log(`[DataFetch] Alarm fetch done: ${controllers.length} controllers`);
  } catch (e) {
    console.error("[DataFetch] Alarm fetch error:", e);
  } finally {
    markDone("alarm");
  }
}

/** Teaching logs: same file as manual Fetch on Teaching Logs page (LOGDATA.DAT → LogPipeline). */
export async function runTeachFetch(): Promise<void> {
  if (!canStart("teach")) return;
  try {
    const controllers = await getControllers();
    for (const c of controllers) {
      await motoFetchFile(c.id, "LOGDATA.DAT");
      await new Promise((r) => setTimeout(r, 300));
    }
    await updateLastRunAt("teach");
    // console.log(`[DataFetch] Teaching (LOGDATA) fetch done: ${controllers.length} controllers`);
  } catch (e) {
    console.error("[DataFetch] Teaching fetch error:", e);
  } finally {
    markDone("teach");
  }
}

const runners: Record<TaskType, () => Promise<void>> = {
  job: runJobFetch,
  tcp: runTcpFetch,
  abso: runAbsoFetch,
  alarm: runAlarmFetch,
  teach: runTeachFetch,
};

export async function processDataFetchSchedule(): Promise<void> {
  try {
    const res = await dbPool.query(
      `SELECT type, enabled, interval_minutes, last_run_at FROM data_fetch_schedule WHERE enabled = true`
    );
    const now = new Date();
    for (const row of res.rows) {
      const type = row.type as TaskType;
      const intervalMinutes = row.interval_minutes ?? 15;
      const lastRunAt = row.last_run_at ? new Date(row.last_run_at) : null;

      const minutesSinceLastRun = lastRunAt
        ? (now.getTime() - lastRunAt.getTime()) / 60000
        : Infinity;

      if (minutesSinceLastRun >= intervalMinutes && runners[type]) {
        await runners[type]();
      }
    }
  } catch (e) {
    console.error("[DataFetch] Schedule check error:", e);
  }
}
