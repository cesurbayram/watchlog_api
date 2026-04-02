import { Request, Response } from "express";
import { dbPool } from "../config/db";

export const getAllDataFetchSchedules = async (_req: Request, res: Response) => {
  try {
    const result = await dbPool.query(
      `SELECT id, type, enabled, interval_minutes, last_run_at, created_at, updated_at 
       FROM data_fetch_schedule 
       ORDER BY type`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching data-fetch schedules:", error);
    return res.status(500).json({ error: "Failed to fetch schedules" });
  }
};

export const getDataFetchScheduleByType = async (req: Request, res: Response) => {
  const { type } = req.params;
  if (!type) return res.status(400).json({ error: "Type is required" });

  try {
    const result = await dbPool.query(
      `SELECT id, type, enabled, interval_minutes, last_run_at, created_at, updated_at 
       FROM data_fetch_schedule 
       WHERE type = $1`,
      [type]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching data-fetch schedule:", error);
    return res.status(500).json({ error: "Failed to fetch schedule" });
  }
};

export const updateDataFetchSchedule = async (req: Request, res: Response) => {
  const { type } = req.params;
  const { enabled, interval_minutes } = req.body;

  if (!type) return res.status(400).json({ error: "Type is required" });

  const validTypes = ["job", "tcp", "abso", "alarm", "teach"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  if (interval_minutes !== undefined) {
    const validIntervals = [5, 10, 15, 30, 60];
    if (!validIntervals.includes(Number(interval_minutes))) {
      return res.status(400).json({
        error: `Invalid interval_minutes. Must be one of: ${validIntervals.join(", ")}`,
      });
    }
  }

  try {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }
    if (interval_minutes !== undefined) {
      updates.push(`interval_minutes = $${paramIndex++}`);
      values.push(Number(interval_minutes));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(type);

    const result = await dbPool.query(
      `UPDATE data_fetch_schedule 
       SET ${updates.join(", ")} 
       WHERE type = $${paramIndex} 
       RETURNING id, type, enabled, interval_minutes, last_run_at, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating data-fetch schedule:", error);
    return res.status(500).json({ error: "Failed to update schedule" });
  }
};
