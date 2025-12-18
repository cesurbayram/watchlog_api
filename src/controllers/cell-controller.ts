import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { CellRequestDto } from "../models/cell-dto";
import { v4 as uuidv4 } from "uuid";

const getCells = async (req: Request, res: Response) => {
  try {
    const cellDbResp = await dbPool.query(`
                SELECT 
                    c.id,
                    c.name,
                    c.status,
                    c.line_id
                FROM cell c
            `);
    return res.status(200).json(cellDbResp.rows);
  } catch (error: any) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createCell = async (req: Request, res: Response) => {
  const { name, status }: CellRequestDto = req.body;
  const newCellId = uuidv4();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "cell" (id, name, status) 
                  VALUES ($1, $2, $3)`,
      [newCellId, name, status],
    );
    await client.query("COMMIT");
    return res.status(201).json({ message: "Cell created successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateCell = async (req: Request, res: Response) => {
  const cellId = req.params?.id;
  const { name, status }: CellRequestDto = req.body;
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE "cell" 
                SET name = $1, status = $2
                WHERE id = $3`,
      [name, status, cellId],
    );
    await client.query("COMMIT");
    return res.status(200).json({ message: "Cell updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteCell = async (req: Request, res: Response) => {
  const cellId = req.params?.id;
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM cell WHERE id = $1`, [cellId]);
    await client.query("COMMIT");
    return res.status(200).json({ message: "Cell deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getCellById = async (req: Request, res: Response) => {
  const cellId = req.params?.id;
  try {
    const dbRes = await dbPool.query(`SELECT * FROM cell WHERE id = $1`, [cellId]);

    if (!dbRes?.rowCount || !(dbRes.rowCount > 0)) {
      return res.status(404).json({ message: "Cell not found" });
    }

    const cell = dbRes.rows[0];
    return res.status(200).json({ ...cell });
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { getCells, createCell, updateCell, deleteCell, getCellById };
