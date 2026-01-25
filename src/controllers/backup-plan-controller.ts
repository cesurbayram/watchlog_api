import { Request, Response } from "express";
import { dbPool } from "../config/db";

export const getBackupPlans = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;

    let query: string;
    let queryParams: string[];

    if (controllerId === "all") {
      query = `
        SELECT 
          bp.*,
          c.name as controller_name,
          c.model as controller_model
        FROM backup_plans bp
        LEFT JOIN controller c ON bp.controller_id = c.id
        ORDER BY bp.created_at DESC
      `;
      queryParams = [];
    } else {
      query = `
        SELECT 
          bp.*,
          c.name as controller_name,
          c.model as controller_model
        FROM backup_plans bp
        LEFT JOIN controller c ON bp.controller_id = c.id
        WHERE bp.controller_id = $1
        ORDER BY bp.created_at DESC
      `;
      queryParams = [controllerId];
    }

    const result = await dbPool.query(query, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching backup plans:", error);
    return res.status(500).json({ error: "Failed to fetch backup plans" });
  }
};

export const createBackupPlan = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;
    const body = req.body;

    const controllerCheck = await dbPool.query("SELECT id FROM controller WHERE id = $1", [controllerId]);

    if (controllerCheck.rows.length === 0) {
      return res.status(404).json({ error: `Controller not found with ID: ${controllerId}` });
    }

    const backupType = body.backup_type || (body.name?.toLowerCase().includes("instant") ? "manual" : "auto");

    const query = `
      INSERT INTO backup_plans (
        id, controller_id, name, days, time, file_types, backup_type
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6
      )
      RETURNING *
    `;

    const result = await dbPool.query(query, [controllerId, body.name, body.days, body.time, body.file_types, backupType]);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating backup plan:", error);
    return res.status(500).json({ error: "Failed to create backup plan" });
  }
};

export const updateBackupPlan = async (req: Request, res: Response) => {
  try {
    const { controllerId, planId } = req.params;
    const updates = req.body;

    const validFields = ["name", "days", "time", "file_types", "is_active"];
    const updateFields = Object.keys(updates)
      .filter((key) => validFields.includes(key))
      .map((key, index) => `${key} = $${index + 3}`);

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const query = `
      UPDATE backup_plans
      SET ${updateFields.join(", ")},
          updated_at = CURRENT_TIMESTAMP
      WHERE controller_id = $1 AND id = $2
      RETURNING *
    `;

    const values = [
      controllerId,
      planId,
      ...Object.keys(updates)
        .filter((key) => validFields.includes(key))
        .map((key) => updates[key]),
    ];

    const result = await dbPool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Backup plan not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating backup plan:", error);
    return res.status(500).json({ error: "Failed to update backup plan" });
  }
};

export const deleteBackupPlan = async (req: Request, res: Response) => {
  try {
    const { controllerId, planId } = req.params;

    const query = `
      DELETE FROM backup_plans
      WHERE controller_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await dbPool.query(query, [controllerId, planId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Backup plan not found" });
    }

    return res.json({ message: "Backup plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting backup plan:", error);
    return res.status(500).json({ error: "Failed to delete backup plan" });
  }
};
