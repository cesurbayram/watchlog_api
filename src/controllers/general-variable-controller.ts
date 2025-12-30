import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

const getGeneralVariables = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { tableName, generalNo, type } = req.query;
  try {
    if (tableName && generalNo) {
      const validTables = ["general_byte_data", "general_int_data", "general_double_data", "general_real_data", "general_string_data"];

      if (!validTables.includes(tableName)) {
        return res.status(400).json({ message: "Invalid table name" });
      }

      const dbRes = await dbPool.query(
        `SELECT value FROM ${tableName} 
             WHERE controller_id = $1 AND general_no = $2`,
        [controllerId, generalNo],
      );

      if (dbRes?.rowCount && dbRes.rowCount > 0) {
        return res.status(200).json({ value: dbRes.rows[0].value });
      }

      return res.status(404).json({ value: null });
    }

    if (!type || !["byte", "int", "double", "real", "string"].includes(type)) {
      return res.status(400).json({
        message: "Invalid or missing variable type. Must be one of: byte, int, double, real, string",
      });
    }

    const tableMap: { [key: string]: string } = {
      byte: "general_byte_data",
      int: "general_int_data",
      double: "general_double_data",
      real: "general_real_data",
      string: "general_string_data",
    };

    const tableNameFromType = tableMap[type];

    const dbRes = await dbPool.query(
      `SELECT 
             id,
             controller_id,
             general_no,
             value,
             '${type}' as variable_type,
             created_at
           FROM ${tableNameFromType}
           WHERE controller_id = $1
           ORDER BY general_no ASC`,
      [controllerId],
    );

    return res.status(200).json(dbRes.rows || []);
  } catch (error: any) {
    console.log("DB Error in general-variable route: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const createGeneralVariable = async (req: Request, res: Response) => {
  const { generalNo, variableType } = req.body;
  const { controllerId } = req.params;

  if (!generalNo || !variableType) {
    return res.status(400).json({ message: "General No and variable type are required" });
  }

  if (!["byte", "int", "double", "real", "string"].includes(variableType)) {
    return res.status(400).json({
      message: "Invalid variable type. Must be one of: byte, int, double, real, string",
    });
  }

  try {
    const tableMap: { [key: string]: { table: string; defaultValue: any } } = {
      byte: { table: "general_byte_data", defaultValue: 0 },
      int: { table: "general_int_data", defaultValue: 0 },
      double: { table: "general_double_data", defaultValue: 0.0 },
      real: { table: "general_real_data", defaultValue: 0.0 },
      string: { table: "general_string_data", defaultValue: "" },
    };

    const { table, defaultValue } = tableMap[variableType];

    const existingRecord = await dbPool.query(`SELECT id FROM ${table} WHERE controller_id = $1 AND general_no = $2`, [controllerId, generalNo]);

    if (existingRecord?.rowCount && existingRecord.rowCount > 0) {
      return res.status(400).json({ message: `General ${variableType} variable already exists` });
    }

    await dbPool.query(
      `INSERT INTO ${table} (id, controller_id, general_no, value, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [uuidv4(), controllerId, generalNo, defaultValue],
    );

    return res.status(201).json({ message: `General ${variableType} variable created successfully` });
  } catch (error: any) {
    console.log("DB Error in general-variable POST: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteGeneralVariable = async (req: Request, res: Response) => {
  const { generalNo, variableType } = req.body;
  const { controllerId } = req.params;

  if (!generalNo || !variableType) {
    return res.status(400).json({ message: "General No and variable type are required" });
  }

  if (!["byte", "int", "double", "real", "string"].includes(variableType)) {
    return res.status(400).json({
      message: "Invalid variable type. Must be one of: byte, int, double, real, string",
    });
  }

  try {
    // Map variable types to table names
    const tableMap: { [key: string]: string } = {
      byte: "general_byte_data",
      int: "general_int_data",
      double: "general_double_data",
      real: "general_real_data",
      string: "general_string_data",
    };

    const tableName = tableMap[variableType];

    const deleteResult = await dbPool.query(`DELETE FROM ${tableName} WHERE controller_id = $1 AND general_no = $2`, [controllerId, generalNo]);

    return res.status(200).json({ message: `General ${variableType} variable deleted successfully` });
  } catch (error: any) {
    console.log("DB Error in general-variable DELETE: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { getGeneralVariables, createGeneralVariable, deleteGeneralVariable };
