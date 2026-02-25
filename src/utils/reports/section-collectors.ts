import { dbPool } from "../../config/db.js";

export interface ReportSection {
  title: string;
  headers: string[];
  rows: string[][];
}

type SectionCollector = (controllerIds?: string[], timeRange?: string) => Promise<ReportSection>;

const sectionRegistry: Record<string, SectionCollector> = {};

export function registerSection(key: string, collector: SectionCollector) {
  sectionRegistry[key] = collector;
}

export function getAvailableSections(): string[] {
  return Object.keys(sectionRegistry);
}

export async function collectSection(
  key: string,
  controllerIds?: string[],
  timeRange?: string,
): Promise<ReportSection | null> {
  const collector = sectionRegistry[key];
  if (!collector) return null;
  return collector(controllerIds, timeRange);
}

function getDaysFromTimeRange(timeRange?: string): number {
  if (timeRange === "24h") return 1;
  if (timeRange === "shift") return 1;
  return 7;
}

function controllerFilter(controllerIds?: string[]): { where: string; params: any[] } {
  if (controllerIds && controllerIds.length > 0) {
    return { where: "AND c.id = ANY($1)", params: [controllerIds] };
  }
  return { where: "", params: [] };
}

// ─── Alarms ───

registerSection("alarms", async (controllerIds, timeRange) => {
  const days = getDaysFromTimeRange(timeRange);
  const filter = controllerFilter(controllerIds);

  const query = `
    SELECT 
      c.name as controller_name,
      a.code,
      a.name as alarm_name,
      a.type,
      a.origin_date
    FROM almhist a
    JOIN controller c ON c.id = a.controller_id
    WHERE a.origin_date::timestamp >= NOW() - INTERVAL '${days} days'
    ${filter.where}
    ORDER BY a.origin_date::timestamp DESC
    LIMIT 50
  `;

  const result = await dbPool.query(query, filter.params);

  return {
    title: "Recent Alarms",
    headers: ["Robot", "Code", "Alarm Name", "Type", "Date"],
    rows: result.rows.map((r: any) => [
      r.controller_name,
      r.code || "N/A",
      r.alarm_name || "N/A",
      r.type || "N/A",
      r.origin_date ? new Date(r.origin_date).toLocaleString("en-US") : "N/A",
    ]),
  };
});

// ─── Utilization ───

registerSection("utilization", async (controllerIds, timeRange) => {
  const days = getDaysFromTimeRange(timeRange);
  const filter = controllerFilter(controllerIds);

  const query = `
    SELECT 
      c.name,
      u.timestamp::date as date,
      ROUND(COALESCE(MAX(u.operating_time), 0)::numeric, 1) as operating_hours,
      ROUND(COALESCE(MAX(u.servo_power_time), 0)::numeric, 1) as servo_hours,
      ROUND(COALESCE(MAX(u.playback_time), 0)::numeric, 1) as playback_hours,
      ROUND(COALESCE(MAX(u.moving_time), 0)::numeric, 1) as moving_hours
    FROM controller c
    LEFT JOIN utilization_data u ON c.id = u.controller_id 
      AND u.timestamp >= NOW() - INTERVAL '${days} days'
    WHERE u.timestamp IS NOT NULL ${filter.where}
    GROUP BY c.id, c.name, u.timestamp::date
    ORDER BY c.name, date DESC
  `;

  const result = await dbPool.query(query, filter.params);

  return {
    title: "Utilization",
    headers: ["Robot", "Date", "Operating (h)", "Servo (h)", "Playback (h)", "Moving (h)"],
    rows: result.rows.map((r: any) => [
      r.name,
      r.date ? new Date(r.date).toLocaleDateString("en-US") : "N/A",
      r.operating_hours?.toString() || "0",
      r.servo_hours?.toString() || "0",
      r.playback_hours?.toString() || "0",
      r.moving_hours?.toString() || "0",
    ]),
  };
});

// ─── Backup Status ───

registerSection("backup-status", async (controllerIds) => {
  const filter = controllerFilter(controllerIds);

  const query = `
    SELECT 
      c.name,
      CASE WHEN bs.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_backup,
      bs.created_at as last_backup_date
    FROM controller c
    LEFT JOIN (
      SELECT DISTINCT ON (controller_id) 
        id, controller_id, created_at
      FROM backup_sessions 
      ORDER BY controller_id, created_at DESC
    ) bs ON c.id = bs.controller_id
    WHERE 1=1 ${filter.where}
    ORDER BY c.name
  `;

  const result = await dbPool.query(query, filter.params);

  return {
    title: "Backup Status",
    headers: ["Robot", "Has Backup", "Last Backup Date"],
    rows: result.rows.map((r: any) => [
      r.name,
      r.has_backup,
      r.last_backup_date ? new Date(r.last_backup_date).toLocaleDateString("en-US") : "Never",
    ]),
  };
});
