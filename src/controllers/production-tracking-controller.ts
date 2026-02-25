import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

function isShiftActive(shiftStart: string, shiftEnd: string): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTime = currentHour * 60 + currentMin;

  const [startHour, startMin] = shiftStart.split(":").map(Number);
  const [endHour, endMin] = shiftEnd.split(":").map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (endTime < startTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

const getProductionTracking = async (req: Request, res: Response) => {
  try {
    const { controllerId, shiftId } = req.query;

    let query = `
      SELECT 
        pt.*,
        c.name AS "controllerName",
        s.name AS "shiftName",
        j.name AS "jobName"
      FROM production_tracking pt
      LEFT JOIN controller c ON pt.controller_id = c.id
      LEFT JOIN shift s ON pt.shift_id = s.id
      LEFT JOIN job_select j ON pt.job_id = j.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCounter = 1;

    if (controllerId) {
      query += ` AND pt.controller_id = $${paramCounter}`;
      params.push(controllerId);
      paramCounter++;
    }

    if (shiftId) {
      query += ` AND pt.shift_id = $${paramCounter}`;
      params.push(shiftId);
      paramCounter++;
    }

    query += " ORDER BY pt.created_at DESC";

    const result = await dbPool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error("GET production tracking error:", error);
    return res.status(500).json({ error: "Failed to fetch production tracking" });
  }
};

const createProductionTracking = async (req: Request, res: Response) => {
  const client = await dbPool.connect();

  try {
    const { controllerId, shiftId, jobId, variableType, variableNo, systemCount, expectedCount, note, autoTrack } = req.body;

    if (!controllerId || !shiftId || !jobId || !variableType || !variableNo) {
      return res.status(400).json({
        error: "Missing required fields: controllerId, shiftId, jobId, variableType, variableNo",
      });
    }

    await client.query("BEGIN");

    const currentCount = systemCount || 0;

    const shiftResult = await client.query(`SELECT shift_start, shift_end FROM shift WHERE id = $1`, [shiftId]);

    let shiftStartCount = null;

    if (shiftResult.rows.length > 0) {
      const { shift_start, shift_end } = shiftResult.rows[0];
      if (isShiftActive(shift_start, shift_end)) {
        shiftStartCount = currentCount;
      }
    }

    const trackingId = uuidv4();
    await client.query(
      `INSERT INTO production_tracking 
       (id, controller_id, shift_id, job_id, variable_type, variable_no, 
        shift_start_count, system_count, expected_count, note, auto_track)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (controller_id, job_id, variable_type, variable_no, shift_id) 
       DO UPDATE SET 
         system_count = EXCLUDED.system_count,
         expected_count = EXCLUDED.expected_count,
         note = EXCLUDED.note,
         auto_track = EXCLUDED.auto_track,
         updated_at = NOW()`,
      [
        trackingId,
        controllerId,
        shiftId,
        jobId,
        variableType,
        variableNo,
        shiftStartCount,
        currentCount,
        expectedCount || null,
        note || null,
        autoTrack ?? true,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      id: trackingId,
      shiftStartCount,
      currentCount,
      isShiftActive: shiftStartCount !== null,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("POST production tracking error:", error);
    return res.status(500).json({ error: "Failed to create production tracking" });
  } finally {
    client.release();
  }
};

const deleteProductionTracking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID is required" });
    }

    const result = await dbPool.query("DELETE FROM production_tracking WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Production tracking not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("DELETE production tracking error:", error);
    return res.status(500).json({ error: "Failed to delete production tracking" });
  }
};

const getProductionTrackingHistory = async (req: Request, res: Response) => {
  try {
    const { controllerId, jobId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        pth.*,
        c.name AS "controllerName",
        s.name AS "shiftName",
        j.name AS "jobName"
      FROM production_tracking_history pth
      LEFT JOIN controller c ON pth.controller_id = c.id
      LEFT JOIN shift s ON pth.shift_id = s.id
      LEFT JOIN job_select j ON pth.job_id = j.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCounter = 1;

    if (controllerId && controllerId !== "all") {
      query += ` AND pth.controller_id = $${paramCounter}`;
      params.push(controllerId);
      paramCounter++;
    }

    if (jobId) {
      query += ` AND pth.job_id = $${paramCounter}`;
      params.push(jobId);
      paramCounter++;
    }

    if (startDate) {
      query += ` AND pth.created_at >= $${paramCounter}`;
      params.push(startDate);
      paramCounter++;
    }

    if (endDate) {
      query += ` AND pth.created_at <= $${paramCounter}`;
      params.push(endDate);
      paramCounter++;
    }

    query += " ORDER BY pth.created_at DESC LIMIT 100";

    const result = await dbPool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error("GET production tracking history error:", error);
    return res.status(500).json({ error: "Failed to fetch production tracking history" });
  }
};

const deleteProductionTrackingHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID is required" });
    }

    const result = await dbPool.query("DELETE FROM production_tracking_history WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Production tracking history not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("DELETE production tracking history error:", error);
    return res.status(500).json({ error: "Failed to delete production tracking history" });
  }
};

const getProductionTrackingStatistics = async (req: Request, res: Response) => {
  try {
    const { controllerId, shiftId } = req.query;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let query = `
      SELECT 
        COUNT(DISTINCT pt.controller_id) as active_controllers,
        COUNT(DISTINCT pt.job_id) as total_jobs,
        COALESCE(SUM(pt.system_count), 0) as total_production,
        COALESCE(SUM(pt.expected_count), 0) as total_expected,
        s.name as shift_name
      FROM production_tracking pt
      LEFT JOIN shift s ON pt.shift_id = s.id
      WHERE pt.updated_at >= $1
    `;

    const params: any[] = [today];
    let paramCounter = 2;

    if (controllerId && controllerId !== "all") {
      query += ` AND pt.controller_id = $${paramCounter}`;
      params.push(controllerId);
      paramCounter++;
    }

    if (shiftId && shiftId !== "all") {
      query += ` AND pt.shift_id = $${paramCounter}`;
      params.push(shiftId);
      paramCounter++;
    }

    query += " GROUP BY s.name";

    const result = await dbPool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(200).json({
        active_controllers: 0,
        total_jobs: 0,
        total_production: 0,
        total_expected: 0,
        difference: 0,
        shift_name: "N/A",
      });
    }

    const stats = result.rows[0];
    const totalProduction = parseInt(stats.total_production || "0");
    const totalExpected = parseInt(stats.total_expected || "0");
    const difference = totalProduction - totalExpected;

    return res.status(200).json({
      active_controllers: parseInt(stats.active_controllers || "0"),
      total_jobs: parseInt(stats.total_jobs || "0"),
      total_production: totalProduction,
      total_expected: totalExpected,
      difference: difference,
      shift_name: stats.shift_name || "N/A",
    });
  } catch (error: any) {
    console.error("GET production tracking statistics error:", error);
    return res.status(500).json({ error: "Failed to fetch production tracking statistics" });
  }
};

const refreshProductionTracking = async (req: Request, res: Response) => {
  const client = await dbPool.connect();

  try {
    const result = await client.query(`
      SELECT 
        pt.id,
        pt.controller_id,
        pt.variable_type,
        pt.variable_no,
        pt.shift_id,
        s.shift_start,
        s.shift_end,
        s.name as shift_name
      FROM production_tracking pt
      JOIN shift s ON pt.shift_id = s.id
    `);

    const allTrackings = result.rows;

    if (allTrackings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No tracking records to refresh",
        updated: 0,
      });
    }

    const activeTrackings = allTrackings.filter((t: any) => isShiftActive(t.shift_start, t.shift_end));

    if (activeTrackings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active shift to refresh",
        updated: 0,
        activeShift: null,
      });
    }

    const tableMap: Record<string, string> = {
      GeneralDouble: "general_double_data",
      GeneralInt: "general_int_data",
      GeneralByte: "general_byte_data",
      GeneralReal: "general_real_data",
    };

    let updatedCount = 0;
    const errors: string[] = [];
    const activeShiftName = activeTrackings[0]?.shift_name || "Unknown";

    for (const tracking of activeTrackings) {
      try {
        const tableName = tableMap[tracking.variable_type];
        if (!tableName) continue;

        const valueRes = await client.query(`SELECT value FROM ${tableName} WHERE controller_id = $1 AND general_no = $2`, [
          tracking.controller_id,
          tracking.variable_no,
        ]);

        if (valueRes.rows.length > 0) {
          const newValue = valueRes.rows[0].value;

          await client.query(
            `UPDATE production_tracking 
             SET system_count = $1, updated_at = NOW()
             WHERE id = $2`,
            [newValue, tracking.id],
          );

          updatedCount++;
        }
      } catch (error) {
        errors.push(`Error updating tracking ${tracking.id}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Refreshed ${updatedCount} tracking records for ${activeShiftName}`,
      updated: updatedCount,
      total: activeTrackings.length,
      activeShift: activeShiftName,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error refreshing production tracking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh production tracking",
    });
  } finally {
    client.release();
  }
};

const getAutoTrackRecords = async (_req: Request, res: Response) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        pt.id,
        pt.controller_id,
        pt.shift_id,
        pt.job_id,
        pt.variable_type,
        pt.variable_no,
        pt.expected_count,
        s.shift_start,
        s.shift_end,
        s.name as shift_name
      FROM production_tracking pt
      JOIN shift s ON pt.shift_id = s.id
      WHERE pt.auto_track = true
    `);

    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error("GET auto-track records error:", error);
    return res.status(500).json({ error: "Failed to fetch auto-track records" });
  }
};

const getAutoTrackRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `
      SELECT 
        pt.id,
        pt.controller_id,
        pt.shift_id,
        pt.job_id,
        pt.variable_type,
        pt.variable_no,
        pt.expected_count,
        pt.auto_track,
        s.shift_start,
        s.shift_end,
        s.name as shift_name
      FROM production_tracking pt
      JOIN shift s ON pt.shift_id = s.id
      WHERE pt.id = $1
    `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Auto-track record not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error("GET auto-track record error:", error);
    return res.status(500).json({ error: "Failed to fetch auto-track record" });
  }
};

const executeAutoTrackUpdate = async (req: Request, res: Response) => {
  const client = await dbPool.connect();

  try {
    const { recordId, controllerId, shiftId, jobId, variableType, variableNo, expectedCount, shiftName, type } = req.body;

    if (!recordId || !controllerId || !variableType || !variableNo || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tableMap: Record<string, string> = {
      GeneralDouble: "general_double_data",
      GeneralInt: "general_int_data",
      GeneralByte: "general_byte_data",
      GeneralReal: "general_real_data",
    };

    const tableName = tableMap[variableType];
    if (!tableName) {
      return res.status(400).json({ error: `Unknown variable type: ${variableType}` });
    }

    const valueRes = await client.query(
      `SELECT value FROM ${tableName} WHERE controller_id = $1 AND general_no = $2`,
      [controllerId, variableNo],
    );

    const systemCount = valueRes.rows[0]?.value || 0;

    await client.query("BEGIN");

    if (type === "start") {
      await client.query(
        `UPDATE production_tracking 
         SET shift_start_count = $1, system_count = $1, updated_at = NOW()
         WHERE id = $2`,
        [systemCount, recordId],
      );
    } else {
      const trackingRecord = await client.query(
        `SELECT shift_start_count FROM production_tracking WHERE id = $1`,
        [recordId],
      );

      const shiftStartCount = trackingRecord.rows[0]?.shift_start_count || 0;
      const dailyProduction = systemCount - shiftStartCount;

      const historyId = uuidv4();
      await client.query(
        `INSERT INTO production_tracking_history 
         (id, controller_id, shift_id, job_id, variable_type, variable_no, 
          shift_start_count, previous_count, current_count, daily_production, expected_count, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          historyId,
          controllerId,
          shiftId,
          jobId,
          variableType,
          variableNo,
          shiftStartCount,
          shiftStartCount,
          systemCount,
          dailyProduction,
          expectedCount,
          `Auto-tracked at shift end (${shiftName})`,
        ],
      );

      await client.query(
        `UPDATE production_tracking 
         SET system_count = $1, updated_at = NOW()
         WHERE id = $2`,
        [systemCount, recordId],
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({ success: true, systemCount });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("POST auto-track execute error:", error);
    return res.status(500).json({ error: "Failed to execute auto-track update" });
  } finally {
    client.release();
  }
};

export {
  getProductionTracking,
  createProductionTracking,
  deleteProductionTracking,
  getProductionTrackingHistory,
  deleteProductionTrackingHistory,
  getProductionTrackingStatistics,
  refreshProductionTracking,
  getAutoTrackRecords,
  getAutoTrackRecord,
  executeAutoTrackUpdate,
};
