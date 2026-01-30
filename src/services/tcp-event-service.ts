import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";
import { SaveTCPEventsParams, TCPEvent, TCPEventFromDB, DailyTCPStats } from "../models/tcp-event-dto";

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

export const saveTCPEvents = async (
  params: SaveTCPEventsParams
): Promise<{ syncId: string; eventsCount: number; newEventsCount: number }> => {
  const { controllerId, events, fileModifiedAt } = params;

  const syncId = uuidv4();
  await dbPool.query(
    `INSERT INTO tcp_log_sync (id, controller_id, file_modified_at, total_events_parsed, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [syncId, controllerId, fileModifiedAt || new Date(), events.length, "completed"]
  );

  let newEventsCount = 0;

  for (const event of events) {
    const eventId = uuidv4();
    const eventDate = parseEventDate(event.date);
    const parsed = event.parsedElement;

    const result = await dbPool.query(
      `INSERT INTO tcp_event 
        (id, controller_id, sync_id, event_index, event_date, event_name, file_name, element_number, element_value, tool_number, parameter_group, parameter_group_name, parameter_index, parameter_name, raw_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (controller_id, event_index) 
       DO UPDATE SET 
         event_date = EXCLUDED.event_date,
         event_name = EXCLUDED.event_name,
         file_name = EXCLUDED.file_name,
         element_number = EXCLUDED.element_number,
         element_value = EXCLUDED.element_value,
         tool_number = EXCLUDED.tool_number,
         parameter_group = EXCLUDED.parameter_group,
         parameter_group_name = EXCLUDED.parameter_group_name,
         parameter_index = EXCLUDED.parameter_index,
         parameter_name = EXCLUDED.parameter_name,
         raw_entry = EXCLUDED.raw_entry,
         sync_id = EXCLUDED.sync_id
       RETURNING (xmax = 0) AS inserted`,
      [
        eventId,
        controllerId,
        syncId,
        event.index,
        eventDate,
        event.event || null,
        event.fileName || null,
        event.elementNumber || null,
        event.elementValue || null,
        parsed?.toolNumber ?? null,
        parsed?.parameterGroup ?? null,
        parsed?.parameterGroupName || null,
        parsed?.parameterIndex ?? null,
        parsed?.parameterName || null,
        event.rawEntry,
      ]
    );

    if (result.rows[0]?.inserted) {
      newEventsCount++;
    }
  }

  await updateDailyStatistics(controllerId, events);

  return { syncId, eventsCount: events.length, newEventsCount };
};

const updateDailyStatistics = async (controllerId: string, events: TCPEvent[]): Promise<void> => {
  const eventsByDate = new Map<string, TCPEvent[]>();

  events.forEach((event) => {
    const dateStr = event.date?.split(" ")[0];
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
    const uniqueTools = new Set<number>();
    dayEvents.forEach((e) => {
      if (e.parsedElement?.actualToolNumber !== undefined) {
        uniqueTools.add(e.parsedElement.actualToolNumber);
      }
    });

    const statId = uuidv4();

    await dbPool.query(
      `INSERT INTO tcp_statistics_daily 
        (id, controller_id, stat_date, total_events, tools_modified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (controller_id, stat_date) 
       DO UPDATE SET 
         total_events = EXCLUDED.total_events,
         tools_modified = EXCLUDED.tools_modified`,
      [statId, controllerId, dateStr, dayEvents.length, uniqueTools.size]
    );
  }
};

export const getTCPEventsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    toolNumber?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: TCPEventFromDB[]; total: number }> => {
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

  if (options?.toolNumber !== undefined) {
    conditions.push(`tool_number = $${paramIndex}`);
    params.push(options.toolNumber);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await dbPool.query(
    `SELECT COUNT(*) as total FROM tcp_event WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const eventsResult = await dbPool.query(
    `SELECT * FROM tcp_event 
     WHERE ${whereClause} 
     ORDER BY event_index DESC 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return { events: eventsResult.rows, total };
};

export const getDailyTCPStatisticsFromDB = async (
  controllerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    groupBy?: "day" | "week" | "month";
  }
): Promise<DailyTCPStats[]> => {
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
      SUM(tools_modified)::integer as tools_modified
     FROM tcp_statistics_daily
     WHERE ${whereClause}
     GROUP BY ${groupExpression}
     ORDER BY stat_date DESC`,
    params
  );

  return result.rows;
};

export const getAllControllersTCPSummary = async (): Promise<
  Array<{
    controller_id: string;
    controller_name: string;
    controller_model: string;
    total_events: number;
    last_tcp_date: Date | null;
    tools_modified: number;
    last_sync_at: Date | null;
  }>
> => {
  const result = await dbPool.query(`
    SELECT 
      c.id as controller_id,
      c.name as controller_name,
      c.model as controller_model,
      COALESCE(SUM(s.total_events), 0)::integer as total_events,
      MAX(e.event_date) as last_tcp_date,
      COALESCE(SUM(s.tools_modified), 0)::integer as tools_modified,
      MAX(sync.synced_at) as last_sync_at
    FROM controller c
    LEFT JOIN tcp_statistics_daily s ON c.id = s.controller_id
    LEFT JOIN tcp_event e ON c.id = e.controller_id
    LEFT JOIN tcp_log_sync sync ON c.id = sync.controller_id
    GROUP BY c.id, c.name, c.model
    ORDER BY last_tcp_date DESC NULLS LAST
  `);

  return result.rows;
};

export const hasTCPData = async (controllerId: string): Promise<boolean> => {
  const result = await dbPool.query(
    `SELECT EXISTS(SELECT 1 FROM tcp_event WHERE controller_id = $1) as has_data`,
    [controllerId]
  );
  return result.rows[0].has_data;
};
