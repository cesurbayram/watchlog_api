import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

const getGeneralSignals = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  try {
    const dbRes = await dbPool.query(
      `SELECT 
             id,
             controller_id,
             general_no,
             value,
             created_at
           FROM general_signal_data
           WHERE controller_id = $1
           ORDER BY general_no ASC`,
      [controllerId],
    );

    return res.status(200).json(dbRes.rows || []);
  } catch (error: any) {
    console.log("DB Error in general-signal route: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const createGeneralSignal = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { generalNo } = req.body;

  if (!generalNo) {
    return res.status(400).json({ message: "General No is required" });
  }

  try {
    const existingRecord = await dbPool.query(`SELECT id FROM general_signal_data WHERE controller_id = $1 AND general_no = $2`, [
      controllerId,
      generalNo,
    ]);

    if (existingRecord?.rowCount && existingRecord.rowCount > 0) {
      return res.status(400).json({ message: "General signal already exists" });
    }

    await dbPool.query(
      `INSERT INTO general_signal_data (id, controller_id, general_no, value, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [uuidv4(), controllerId, generalNo, false],
    );

    return res.status(201).json({ message: "General signal created successfully" });
  } catch (error: any) {
    console.log("DB Error in general-signal POST: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteGeneralSignal = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { generalNo } = req.body;

  if (!generalNo) {
    return res.status(400).json({ message: "General No is required" });
  }

  try {
    const deleteResult = await dbPool.query(`DELETE FROM general_signal_data WHERE controller_id = $1 AND general_no = $2`, [
      controllerId,
      generalNo,
    ]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "General signal not found" });
    }

    return res.status(200).json({ message: "General signal deleted successfully" });
  } catch (error: any) {
    console.log("DB Error in general-signal DELETE: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { getGeneralSignals, createGeneralSignal, deleteGeneralSignal };
