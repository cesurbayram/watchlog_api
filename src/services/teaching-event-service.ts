import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";

// Types
export interface TeachingEvent {
  index: number;
  date: string;
  type: "POINT_MODIFICATION" | "INSTRUCTION_INSERT" | "INSTRUCTION_DELETE" | "TEACH_MODE";
  fileName?: string;
  lineNumber?: string;
  details: string;
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface SaveTeachingEventsParams {
  controllerId: string;
  events: TeachingEvent[];
  fileModifiedAt?: Date;
}

export interface TeachingEventFromDB {
  id: string;
  controller_id: string;
  event_index: number;
  event_date: Date | null;
  event_type: string;
  file_name: string | null;
  line_number: string | null;
  details: string | null;
  raw_entry: string | null;
  created_at: Date;
}

export interface DailyStats {
  stat_date: Date;
  point_modifications: number;
  instruction_inserts: number;
  instruction_deletes: number;
  teach_mode_activations: number;
  total_events: number;
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

// Save teaching events to database (upsert)
export const saveTeachingEvents = async (params: SaveTeachingEventsParams): Promise<{ syncId: string; eventsCount: number; newEventsCount: number }> => {
  const { controllerId, events, fileModifiedAt } = params;

  // 1. Create sync record
  const syncId = uuidv4();
  await dbPool.query(
    `INSERT INTO teaching_log_sync (id, controller_id, file_modified_at, total_events_parsed, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [syncId, controllerId, fileModifiedAt || new Date(), events.length, "completed"]
  );

  let newEventsCount = 0;

  // 2. Upsert events
  for (const event of events) {
    const eventId = uuidv4();
    const eventDate = parseEventDate(event.date);

    const result = await dbPool.query(
      `INSERT INTO teaching_event 
        (id, controller_id, sync_id, event_index, event_date, event_type, file_name, line_number, details, raw_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (controller_id, event_index) 
       DO UPDATE SET 
         event_date = EXCLUDED.event_date,
         file_name = EXCLUDED.file_name,
         line_number = EXCLUDED.line_number,
         details = EXCLUDED.details,
         raw_entry = EXCLUDED.raw_entry,
         sync_id = EXCLUDED.sync_id
       RETURNING (xmax = 0) AS inserted`,
      [eventId, controllerId, syncId, event.index, eventDate, event.type, event.fileName || null, event.lineNumber || null, event.details, event.rawEntry]
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
const updateDailyStatistics = async (controllerId: string, events: TeachingEvent[]): Promise<void> => {
  // Group events by date
  const eventsByDate = new Map<string, TeachingEvent[]>();

  events.forEach((event) => {
    const dateStr = event.date.split(" ")[0]; // "2025/12/28" format
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
    const stats = {
      pointModifications: dayEvents.filter((e) => e.type === "POINT_MODIFICATION").length,
      instructionInserts: dayEvents.filter((e) => e.type === "INSTRUCTION_INSERT").length,
      instructionDeletes: dayEvents.filter((e) => e.type === "INSTRUCTION_DELETE").length,
      teachModeActivations: dayEvents.filter((e) => e.type === "TEACH_MODE").length,
      total: dayEvents.length,
    };

    const statId = uuidv4();

    await dbPool.query(
      `INSERT INTO teaching_statistics_daily 
        (id, controller_id, stat_date, point_modifications, instruction_inserts, instruction_deletes, teach_mode_activations, total_events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (controller_id, stat_date) 
       DO UPDATE SET 
         point_modifications = EXCLUDED.point_modifications,
         instruction_inserts = EXCLUDED.instruction_inserts,
         instruction_deletes = EXCLUDED.instruction_deletes,
         teach_mode_activations = EXCLUDED.teach_mode_activations,
         total_events = EXCLUDED.total_events`,
      [statId, controllerId, dateStr, stats.pointModifications, stats.instructionInserts, stats.instructionDeletes, stats.teachModeActivations, stats.total]
    );
  }
};

// Get teaching events from database
export const getTeachingEventsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
    fileName?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: TeachingEventFromDB[]; total: number }> => {
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

  if (options?.eventType) {
    conditions.push(`event_type = $${paramIndex}`);
    params.push(options.eventType);
    paramIndex++;
  }

  if (options?.fileName) {
    conditions.push(`file_name = $${paramIndex}`);
    params.push(options.fileName);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Get total count
  const countResult = await dbPool.query(`SELECT COUNT(*) as total FROM teaching_event WHERE ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get events with pagination
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const eventsResult = await dbPool.query(
    `SELECT * FROM teaching_event 
     WHERE ${whereClause} 
     ORDER BY event_index DESC 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return { events: eventsResult.rows, total };
};

// Get daily statistics from database
export const getDailyStatisticsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }
): Promise<DailyStats[]> => {
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
      SUM(point_modifications)::integer as point_modifications,
      SUM(instruction_inserts)::integer as instruction_inserts,
      SUM(instruction_deletes)::integer as instruction_deletes,
      SUM(teach_mode_activations)::integer as teach_mode_activations,
      SUM(total_events)::integer as total_events
     FROM teaching_statistics_daily
     WHERE ${whereClause}
     GROUP BY ${groupExpression}
     ORDER BY stat_date DESC`,
    params
  );

  return result.rows;
};

// Get all controllers summary
export const getAllControllersSummary = async (): Promise<
  Array<{
    controller_id: string;
    controller_name: string;
    controller_model: string;
    total_events: number;
    last_teaching_date: Date | null;
    point_modifications: number;
    instruction_inserts: number;
    instruction_deletes: number;
    teach_mode_activations: number;
    last_sync_at: Date | null;
  }>
> => {
  const result = await dbPool.query(`
    SELECT 
      c.id as controller_id,
      c.name as controller_name,
      c.model as controller_model,
      COALESCE(SUM(s.total_events), 0)::integer as total_events,
      MAX(e.event_date) as last_teaching_date,
      COALESCE(SUM(s.point_modifications), 0)::integer as point_modifications,
      COALESCE(SUM(s.instruction_inserts), 0)::integer as instruction_inserts,
      COALESCE(SUM(s.instruction_deletes), 0)::integer as instruction_deletes,
      COALESCE(SUM(s.teach_mode_activations), 0)::integer as teach_mode_activations,
      MAX(sync.synced_at) as last_sync_at
    FROM controller c
    LEFT JOIN teaching_statistics_daily s ON c.id = s.controller_id
    LEFT JOIN teaching_event e ON c.id = e.controller_id
    LEFT JOIN teaching_log_sync sync ON c.id = sync.controller_id
    GROUP BY c.id, c.name, c.model
    ORDER BY last_teaching_date DESC NULLS LAST
  `);

  return result.rows;
};

// Get unique file names for a controller
export const getUniqueFileNames = async (controllerId: string): Promise<string[]> => {
  const result = await dbPool.query(
    `SELECT DISTINCT file_name 
     FROM teaching_event 
     WHERE controller_id = $1 AND file_name IS NOT NULL
     ORDER BY file_name`,
    [controllerId]
  );

  return result.rows.map((row) => row.file_name);
};

// Check if controller has teaching data in DB
export const hasTeachingData = async (controllerId: string): Promise<boolean> => {
  const result = await dbPool.query(`SELECT EXISTS(SELECT 1 FROM teaching_event WHERE controller_id = $1) as has_data`, [controllerId]);
  return result.rows[0].has_data;
};
