import { Request, Response } from "express";
import { dbPool } from "../config/db";

const getUtilizationByControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.body;
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

export { getUtilizationByControllerId };
