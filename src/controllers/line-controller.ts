import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { LineRequestDto } from "../models/line-dto";

const getLines = async (req: Request, res: Response) => {
  try {
    const lineDbResp = await dbPool.query(`
                SELECT 
                    l.id,
                    l.name,
                    l.status,
                    l.factory_id,
                    ARRAY_AGG(c.id) FILTER (WHERE c.id IS NOT NULL) as "cellIds"
                FROM
                    line l
                    LEFT JOIN cell c ON l.id = c.line_id
                GROUP BY l.id, l.name, l.status, l.factory_id
            `);
    return res.status(200).json(lineDbResp.rows);
  } catch (error: any) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createLine = async (req: Request, res: Response) => {
  const { name, status, cellIds }: LineRequestDto = await req.body;
  if (!cellIds || cellIds.length === 0) {
    return res.status(500).json({ message: "Cells are required" });
  }

  const newLineId = uuidv4();
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
            INSERT INTO line (id, name, status, factory_id) VALUES ($1, $2, $3, $4)
        `,
      [newLineId, name, status, null],
    );

    await client.query(
      `
            UPDATE cell SET line_id = $1 WHERE id = ANY($2)
        `,
      [newLineId, cellIds],
    );

    await client.query("COMMIT");
    return res.status(201).json({ message: "Line created successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateLine = async (req: Request, res: Response) => {
  const lineId = req.params?.id;
  const { name, status, cellIds }: LineRequestDto = req.body;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
                UPDATE line SET name = $1, status = $2 WHERE id = $3    
            `,
      [name, status, lineId],
    );

    await client.query(
      ` 
                UPDATE cell SET line_id = $1 WHERE line_id = $2
            `,
      [null, lineId],
    );

    await client.query(
      `
                UPDATE cell SET line_id = $1 WHERE id = ANY($2)
            `,
      [lineId, cellIds],
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Line updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteLine = async (req: Request, res: Response) => {
  const lineId = req.params?.id;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM line WHERE id = $1`, [lineId]);
    await client.query("COMMIT");
    return res.status(200).json({ message: "Line deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getLineById = async (req: Request, res: Response) => {
  const lineById = req.params?.id;
  try {
    const dbRes = await dbPool.query(
      `SELECT
            l.id,
            l.name,
            l.status,
          COALESCE(array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL), '{}') AS "cellIds"
          FROM
          line l LEFT JOIN
            cell c ON l.id = c.line_id
          WHERE l.id = $1
          GROUP BY l.id`,
      [lineById],
    );

    if (!dbRes?.rowCount || !(dbRes.rowCount > 0)) {
      return res.status(404).json({ message: "Line not found" });
    }
    const line = dbRes.rows[0];
    return res.status(200).json({ ...line });
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { getLines, createLine, updateLine, deleteLine, getLineById };
