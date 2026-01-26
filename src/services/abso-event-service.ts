import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";

// Types
export interface AbsoEvent {
  index: number;
  date: string;
  groupNumber: string;
  axisNumber: string;
  setValue: string;
  currValue: {
    R1: {
      S?: number;
      L?: number;
      U?: number;
      R?: number;
      B?: number;
      T?: number;
    };
  };
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface SaveAbsoEventsParams {
  controllerId: string;
  events: AbsoEvent[];
  fileModifiedAt?: Date;
}

export interface AbsoEventFromDB {
  id: string;
  controller_id: string;
  event_index: number;
  event_date: Date | null;
  group_number: string | null;
  axis_number: string | null;
  set_value: string | null;
  axis_s: number | null;
  axis_l: number | null;
  axis_u: number | null;
  axis_r: number | null;
  axis_b: number | null;
  axis_t: number | null;
  raw_entry: string | null;
  created_at: Date;
}

export interface DailyAbsoStats {
  stat_date: Date;
  total_events: number;
  axis_changes: number;
}

// Parse event date string to Date object
const parseEventDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.trim() === "") return null;

  try {
    const [datePart, timePart] = dateStr.trim().split(" ");
    if (datePart && timePart) {
      const [year, month, day] = datePart.split("/");
      if (!year || !month || !day) return null;

      const paddedMonth = month.padStart(2, "0");
      const paddedDay = day.padStart(2, "0");
      const timeFormatted = timePart.includes(":") ? timePart : timePart + ":00";

      const parsed = new Date(`${year}-${paddedMonth}-${paddedDay}T${timeFormatted}`);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
  } catch {
    return null;
  }
  return null;
};

// Save ABSO events to database (upsert)
export const saveAbsoEvents = async (
  params: SaveAbsoEventsParams
): Promise<{ syncId: string; eventsCount: number; newEventsCount: number }> => {
  const { controllerId, events, fileModifiedAt } = params;

  // 1. Create sync record
  const syncId = uuidv4();
  await dbPool.query(
    `INSERT INTO abso_log_sync (id, controller_id, file_modified_at, total_events_parsed, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [syncId, controllerId, fileModifiedAt || new Date(), events.length, "completed"]
  );

  let newEventsCount = 0;

  // 2. Upsert events
  for (const event of events) {
    const eventId = uuidv4();
    const eventDate = parseEventDate(event.date);

    const r1 = event.currValue?.R1 || {};

    const result = await dbPool.query(
      `INSERT INTO abso_event 
        (id, controller_id, sync_id, event_index, event_date, group_number, axis_number, set_value, axis_s, axis_l, axis_u, axis_r, axis_b, axis_t, raw_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (controller_id, event_index) 
       DO UPDATE SET 
         event_date = EXCLUDED.event_date,
         group_number = EXCLUDED.group_number,
         axis_number = EXCLUDED.axis_number,
         set_value = EXCLUDED.set_value,
         axis_s = EXCLUDED.axis_s,
         axis_l = EXCLUDED.axis_l,
         axis_u = EXCLUDED.axis_u,
         axis_r = EXCLUDED.axis_r,
         axis_b = EXCLUDED.axis_b,
         axis_t = EXCLUDED.axis_t,
         raw_entry = EXCLUDED.raw_entry,
         sync_id = EXCLUDED.sync_id
       RETURNING (xmax = 0) AS inserted`,
      [
        eventId,
        controllerId,
        syncId,
        event.index,
        eventDate,
        event.groupNumber || null,
        event.axisNumber || null,
        event.setValue || null,
        r1.S ?? null,
        r1.L ?? null,
        r1.U ?? null,
        r1.R ?? null,
        r1.B ?? null,
        r1.T ?? null,
        event.rawEntry,
      ]
    );

    if (result.rows[0]?.inserted) {
      newEventsCount++;
    }
  }

  // 3. Update daily statistics
  await updateDailyStatistics(controllerId, events);

  return { syncId, eventsCount: events.length, newEventsCount };
};

// Update daily statistics
const updateDailyStatistics = async (controllerId: string, events: AbsoEvent[]): Promise<void> => {
  // Group events by date
  const eventsByDate = new Map<string, AbsoEvent[]>();

  events.forEach((event) => {
    const dateStr = event.date?.split(" ")[0]; // "2025/12/28" format
    if (dateStr && dateStr.includes("/")) {
      const [year, month, day] = dateStr.split("/");
      const normalizedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      if (!eventsByDate.has(normalizedDate)) {
        eventsByDate.set(normalizedDate, []);
      }
      eventsByDate.get(normalizedDate)!.push(event);
    }
  });

  // Upsert stats for each day
  for (const [dateStr, dayEvents] of eventsByDate) {
    // Count axis changes (how many axes have values)
    let axisChanges = 0;
    dayEvents.forEach((e) => {
      const r1 = e.currValue?.R1 || {};
      if (r1.S !== undefined) axisChanges++;
      if (r1.L !== undefined) axisChanges++;
      if (r1.U !== undefined) axisChanges++;
      if (r1.R !== undefined) axisChanges++;
      if (r1.B !== undefined) axisChanges++;
      if (r1.T !== undefined) axisChanges++;
    });

    const statId = uuidv4();

    await dbPool.query(
      `INSERT INTO abso_statistics_daily 
        (id, controller_id, stat_date, total_events, axis_changes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (controller_id, stat_date) 
       DO UPDATE SET 
         total_events = EXCLUDED.total_events,
         axis_changes = EXCLUDED.axis_changes`,
      [statId, controllerId, dateStr, dayEvents.length, axisChanges]
    );
  }
};

// Get ABSO events from database
export const getAbsoEventsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: AbsoEventFromDB[]; total: number }> => {
  const conditions: string[] = ["controller_id = $1"];
  const params: (string | number)[] = [controllerId];
  let paramIndex = 2;

  if (options?.startDate) {
    conditions.push(`event_date >= $${paramIndex}`);
    params.push(options.startDate);
    paramIndex++;
  }

  if (options?.endDate) {
    conditions.push(`event_date <= $${paramIndex}`);
    params.push(options.endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Get total count
  const countResult = await dbPool.query(
    `SELECT COUNT(*) as total FROM abso_event WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get events with pagination
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const eventsResult = await dbPool.query(
    `SELECT * FROM abso_event 
     WHERE ${whereClause} 
     ORDER BY event_index DESC 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return { events: eventsResult.rows, total };
};

// Get daily statistics from database
export const getDailyAbsoStatisticsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }
): Promise<DailyAbsoStats[]> => {
  const conditions: string[] = ["controller_id = $1"];
  const params: string[] = [controllerId];
  let paramIndex = 2;

  if (options?.startDate) {
    conditions.push(`stat_date >= $${paramIndex}`);
    params.push(options.startDate);
    paramIndex++;
  }

  if (options?.endDate) {
    conditions.push(`stat_date <= $${paramIndex}`);
    params.push(options.endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");
  const groupBy = options?.groupBy || "day";

  let groupExpression: string;
  switch (groupBy) {
    case "week":
      groupExpression = "DATE_TRUNC('week', stat_date)";
      break;
    case "month":
      groupExpression = "DATE_TRUNC('month', stat_date)";
      break;
    default:
      groupExpression = "stat_date";
  }

  const result = await dbPool.query(
    `SELECT 
      ${groupExpression} as stat_date,
      SUM(total_events)::integer as total_events,
      SUM(axis_changes)::integer as axis_changes
     FROM abso_statistics_daily
     WHERE ${whereClause}
     GROUP BY ${groupExpression}
     ORDER BY stat_date DESC`,
    params
  );

  return result.rows;
};

// Get all controllers ABSO summary
export const getAllControllersAbsoSummary = async (): Promise<
  Array<{
    controller_id: string;
    controller_name: string;
    controller_model: string;
    total_events: number;
    last_abso_date: Date | null;
    axis_changes: number;
    last_sync_at: Date | null;
  }>
> => {
  const result = await dbPool.query(`
    SELECT 
      c.id as controller_id,
      c.name as controller_name,
      c.model as controller_model,
      COALESCE(SUM(s.total_events), 0)::integer as total_events,
      MAX(e.event_date) as last_abso_date,
      COALESCE(SUM(s.axis_changes), 0)::integer as axis_changes,
      MAX(sync.synced_at) as last_sync_at
    FROM controller c
    LEFT JOIN abso_statistics_daily s ON c.id = s.controller_id
    LEFT JOIN abso_event e ON c.id = e.controller_id
    LEFT JOIN abso_log_sync sync ON c.id = sync.controller_id
    GROUP BY c.id, c.name, c.model
    ORDER BY last_abso_date DESC NULLS LAST
  `);

  return result.rows;
};

// Check if controller has ABSO data in DB
export const hasAbsoData = async (controllerId: string): Promise<boolean> => {
  const result = await dbPool.query(
    `SELECT EXISTS(SELECT 1 FROM abso_event WHERE controller_id = $1) as has_data`,
    [controllerId]
  );
  return result.rows[0].has_data;
};
