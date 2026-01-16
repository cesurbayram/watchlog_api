import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

const getUtilizationByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { timeRange } = req.query;

  let timeFilter;
  switch (timeRange) {
    case "30d":
      timeFilter = "AND timestamp >= NOW() - INTERVAL '30 days'";
      break;
    case "3m":
      timeFilter = "AND timestamp >= NOW() - INTERVAL '3 months'";
      break;
    default:
      timeFilter = "AND timestamp >= NOW() - INTERVAL '7 days'";
      break;
  }

  try {
    const client = await dbPool.connect();

    const query = `
          SELECT 
            timestamp,
            control_power_time,
            servo_power_time,
            playback_time,
            moving_time,
            operating_time
          FROM utilization_data 
          WHERE controller_id = $1 
          ${timeFilter}
          ORDER BY timestamp DESC
        `;

    const result = await client.query(query, [controllerId]);
    client.release();

    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createUtilization = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;
    const { controlPowerTime, servoPowerTime, playbackTime, movingTime, operatingTime } = req.body;

    const id = uuidv4();

    const query = `
      INSERT INTO utilization_data (
        id,
        controller_id,
        control_power_time,
        servo_power_time,
        playback_time,
        moving_time,
        operating_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await dbPool.query(query, [id, controllerId, controlPowerTime, servoPowerTime, playbackTime, movingTime, operatingTime]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating utilization:", error);
    return res.status(500).json({ error: "Failed to create utilization data" });
  }
};

export { getUtilizationByControllerId, createUtilization };
