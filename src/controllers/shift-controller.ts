import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { ShiftRequestDto, ShiftResponseDto } from "../models/shift-dto";
import { v4 as uuidv4 } from "uuid";

const getShifts = async (req: Request, res: Response) => {
  try {
    const shiftDbResp = await dbPool.query(`
          SELECT 
            s.id, 
            s.name, 
            s.shift_start AS "shiftStart", 
            s.shift_end AS "shiftEnd", 
            s.created_at AS "createdAt", 
            s.updated_at AS "updatedAt" 
          FROM shift s
          WHERE s.deleted_at IS NULL
          ORDER BY s.created_at DESC
        `);

    const shifts: ShiftResponseDto[] = shiftDbResp.rows;
    return res.status(200).json(shifts);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getShiftById = async (req: Request, res: Response) => {
  const shiftId = req.params?.id;

  if (!shiftId) {
    return res.status(400).json({ message: "Shift ID is required" });
  }

  try {
    const shiftDbResp = await dbPool.query(
      `
        SELECT 
          s.id, 
          s.name, 
          s.shift_start AS "shiftStart", 
          s.shift_end AS "shiftEnd",                                    
          s.created_at AS "createdAt", 
          s.updated_at AS "updatedAt" 
        FROM shift s
        WHERE s.id = $1 AND s.deleted_at IS NULL
        `,
      [shiftId],
    );

    if (shiftDbResp.rows.length === 0) {
      return res.status(404).json({ message: "Shift not found" });
    }

    const shift = shiftDbResp.rows[0];
    return res.status(200).json(shift);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createShift = async (req: Request, res: Response) => {
  const { name, shiftStart, shiftEnd }: ShiftRequestDto = req.body;
  const newShiftId = uuidv4();

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO "shift" (id, name, shift_start, shift_end)
      VALUES ($1, $2, $3, $4)`,
      [newShiftId, name, shiftStart, shiftEnd],
    );

    await client.query("COMMIT");
    return res.status(201).json({ id: newShiftId });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateShift = async (req: Request, res: Response) => {
  const shiftId = req.params?.id;
  const { name, shiftStart, shiftEnd }: ShiftRequestDto = req.body;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE "shift" SET 
        name = $1, 
        shift_start = $2, 
        shift_end = $3, 
        updated_at = NOW()
      WHERE id = $4`,
      [name, shiftStart, shiftEnd, shiftId],
    );

    await client.query("COMMIT");
    return res.status(200).json({ shiftId });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteShift = async (req: Request, res: Response) => {
  const shiftId = req.params?.id;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE "shift" SET 
        deleted_at = NOW() 
      WHERE id = $1`,
      [shiftId],
    );

    await client.query("COMMIT");
    return res.status(200).json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export { getShifts, createShift, updateShift, deleteShift, getShiftById };
