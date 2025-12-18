import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { FactoryRequestDto } from "../models/factory-dto";
import { v4 as uuidv4 } from "uuid";

const getFactories = async (req: Request, res: Response) => {
  try {
    const factoryDbResp = await dbPool.query(`
                SELECT 
                    f.id,
                    f.name,
                    f.status,
                    ARRAY_AGG(l.id) FILTER (WHERE l.id IS NOT NULL) as "lineIds"
                FROM
                    factory f
                    LEFT JOIN line l ON f.id = l.factory_id
                GROUP BY f.id, f.name, f.status
            `);
    return res.status(200).json(factoryDbResp.rows);
  } catch (error: any) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getFactoryById = async (req: Request, res: Response) => {
  const factoryId = req.params?.id;
  try {
    const dbRes = await dbPool.query(
      `
            SELECT
                f.id,
                f.name,
                f.status,
                COALESCE(array_agg(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL), '{}') AS "lineIds"
            FROM
                factory f LEFT JOIN
                line l ON f.id = l.factory_id
                WHERE f.id = $1
                GROUP BY f.id
            `,
      [factoryId],
    );

    if (!dbRes?.rowCount || !(dbRes.rowCount > 0)) {
      return res.status(404).json({ message: "Factory not found" });
    }
    const factory = dbRes.rows[0];
    return res.status(200).json(factory);
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(404).json({ message: "Internal server error" });
  }
};

const createFactory = async (req: Request, res: Response) => {
  const { name, status, lineIds }: FactoryRequestDto = req.body;

  if (!lineIds || lineIds.length === 0) {
    return res.status(500).json({ message: "At least one line required" });
  }

  const newFactoryId = uuidv4();

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO factory (id, name, status) 
            VALUES ($1, $2, $3)`,
      [newFactoryId, name, status],
    );
    await client.query(
      `
            UPDATE line SET factory_id = $1 WHERE id = ANY ($2)
        `,
      [newFactoryId, lineIds],
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

const updateFactory = async (req: Request, res: Response) => {
  const factoryId = req.params?.id;
  const { name, status, lineIds }: FactoryRequestDto = req.body;

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
                UPDATE factory SET name = $1, status = $2 WHERE id = $3
            `,
      [name, status, factoryId],
    );

    await client.query(
      `
                UPDATE line SET factory_id = $1 WHERE factory_id = $2 
            `,
      [null, factoryId],
    );

    await client.query(
      `
                UPDATE line SET factory_id = $1 WHERE id = ANY($2)
            `,
      [factoryId, lineIds],
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Factory updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteFactory = async (req: Request, res: Response) => {
  const factoryId = req.params?.id;
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "factory" WHERE id = $1`, [factoryId]);
    await client.query("COMMIT");
    return res.status(200).json({ message: "Factory deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export { getFactories, getFactoryById, updateFactory, createFactory, deleteFactory };
