import { Request, Response } from "express";
import { dbPool } from "../config/db";

export const getTorkData = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;

    const torkData = await dbPool.query(
      `SELECT * FROM tork_data 
       WHERE controller_id = $1 
       ORDER BY timestamp ASC`,
      [controllerId]
    );

    return res.json(torkData.rows);
  } catch (error) {
    console.error("Error fetching tork data:", error);
    return res.status(500).json({ error: "Failed to fetch tork data" });
  }
};

export const clearTorkData = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;

    await dbPool.query(`DELETE FROM tork_data WHERE controller_id = $1`, [
      controllerId,
    ]);

    return res.json({ message: "Tork data cleared successfully", controllerId });
  } catch (error) {
    console.error("Error clearing tork data:", error);
    return res.status(500).json({ error: "Failed to clear tork data" });
  }
};
