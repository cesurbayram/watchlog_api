import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { ComparisonResult } from "../models/teaching-event-dto";

const saveComparison = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const client = await dbPool.connect();

  try {
    const body: ComparisonResult = req.body;
    const { file1Name, file2Name, file1Format, file2Format, differences, statistics } = body;

    if (!file1Name || !file2Name) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const newComparisonId = uuidv4();
    const comparisonDate = new Date().toISOString();

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO teaching_comparisons (
        id,
        controller_id,
        file1_name,
        file2_name,
        file1_format,
        file2_format,
        comparison_date,
        statistics,
        differences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newComparisonId,
        controllerId,
        file1Name,
        file2Name,
        file1Format,
        file2Format,
        comparisonDate,
        JSON.stringify(statistics),
        JSON.stringify(differences),
      ],
    );

    await client.query("COMMIT");

    const result: ComparisonResult = {
      id: newComparisonId,
      file1Name,
      file2Name,
      file1Format,
      file2Format,
      comparisonDate,
      differences,
      statistics,
    };

    return res.status(201).json(result);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getComparisonHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  try {
    const result = await dbPool.query(
      `SELECT 
        id,
        controller_id as "controllerId",
        file1_name as "file1Name",
        file2_name as "file2Name",
        comparison_date as "comparisonDate",
        statistics
      FROM teaching_comparisons 
      WHERE controller_id = $1 
      ORDER BY comparison_date DESC`,
      [controllerId],
    );

    const formattedRows = result.rows.map((row) => ({
      id: row.id,
      file1Name: row.file1Name,
      file2Name: row.file2Name,
      comparisonDate: row.comparisonDate,
      statistics: typeof row.statistics === "string" ? JSON.parse(row.statistics) : row.statistics,
    }));

    return res.status(200).json(formattedRows);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getComparisonById = async (req: Request, res: Response) => {
  const { controllerId, comparisonId } = req.params;

  try {
    const result = await dbPool.query(
      `SELECT 
        id,
        controller_id as "controllerId",
        file1_name as "file1Name",
        file2_name as "file2Name",
        file1_format as "file1Format",
        file2_format as "file2Format",
        comparison_date as "comparisonDate",
        statistics,
        differences
      FROM teaching_comparisons 
      WHERE id = $1 AND controller_id = $2`,
      [comparisonId, controllerId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Comparison not found" });
    }

    const comparison = {
      ...result.rows[0],
      statistics: typeof result.rows[0].statistics === "string" ? JSON.parse(result.rows[0].statistics) : result.rows[0].statistics,
      differences: typeof result.rows[0].differences === "string" ? JSON.parse(result.rows[0].differences) : result.rows[0].differences,
    };

    return res.status(200).json(comparison);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteComparison = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { comparisonId } = req.query;
  const client = await dbPool.connect();

  try {
    if (!comparisonId) {
      return res.status(400).json({ message: "ComparisonId is required" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `DELETE FROM teaching_comparisons 
       WHERE id = $1 AND controller_id = $2`,
      [comparisonId, controllerId],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Comparison not found" });
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Comparison deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export { saveComparison, getComparisonHistory, getComparisonById, deleteComparison };
