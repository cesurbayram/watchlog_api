import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";
import path from "path";
import os from "os";
import fs from "fs";
import { parseSystemFile } from "../utils/parse-system-file";

const createShiftMaintenance = async (req: Request, res: Response) => {
  const { controller_id, maintenance_type, maintenance_date, servo_hours: provided_servo_hours, technician, notes } = req.body;

  try {
    const servo_hours = provided_servo_hours || 0;

    const maintenanceId = uuidv4();
    await dbPool.query(
      `
          INSERT INTO maintenance_history 
          (id, controller_id, maintenance_type, maintenance_date, servo_hours, technician, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
      [maintenanceId, controller_id, maintenance_type, maintenance_date, servo_hours, technician, notes],
    );

    // try {
    //   const controllerInfo = await dbPool.query(`SELECT name FROM controller WHERE id = $1`, [controller_id]);

    //     if (controllerInfo.rows.length > 0) {
    //       const controller = controllerInfo.rows[0];
    //       await NotificationService.notifyMaintenanceScheduled(
    //         maintenanceId,
    //         controller.name,
    //         maintenance_type,
    //         technician,
    //         maintenance_date
    //       );
    //     }
    // } catch (notificationError) {
    //   console.error("Failed to send notification:", notificationError);
    // }

    return res.status(200).json({
      message: "Maintenance recorded successfully",
      id: maintenanceId,
    });
  } catch (error) {
    console.error("Error creating maintenance:", error);
    return res.status(500).json({ error: "Failed to create maintenance" });
  }
};

const deleteShiftMaintenance = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await dbPool.query("DELETE FROM maintenance_history WHERE id = $1", [id]);

    return res.status(200).json({
      success: true,
      message: "Maintenance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting maintenance record:", error);
    return res.status(500).json({ error: "Failed to delete maintenance record" });
  }
};

const updateShiftMaintenance = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { maintenance_type, maintenance_date, technician, notes } = req.body;

  try {
    const updateFields = [];
    const updateValues = [];

    let paramIndex = 1;
    if (maintenance_type) {
      updateFields.push(`maintenance_type = $${paramIndex++}`);
      updateValues.push(maintenance_type);
    }
    if (maintenance_date) {
      updateFields.push(`maintenance_date = $${paramIndex++}`);
      updateValues.push(maintenance_date);
    }
    if (technician) {
      updateFields.push(`technician = $${paramIndex++}`);
      updateValues.push(technician);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updateValues.push(id);

    await dbPool.query(`UPDATE maintenance_history SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`, updateValues);

    // try {
    //   const maintenanceInfo = await dbPool.query(
    //     `SELECT mh.maintenance_type, mh.maintenance_date, mh.technician, mh.notes, c.name as controller_name
    //      FROM maintenance_history mh
    //      JOIN controller c ON mh.controller_id = c.id
    //      WHERE mh.id = $1`,
    //     [id]
    //   );

    //   if (maintenanceInfo.rows.length > 0) {
    //     const info = maintenanceInfo.rows[0];
    //     await NotificationService.notifyMaintenanceCompleted(
    //       id,
    //       info.controller_name,
    //       info.maintenance_type,
    //       info.technician,
    //       info.maintenance_date,
    //       info.notes
    //     );
    //   }
    // } catch (notificationError) {
    //   console.error("Failed to send notification:", notificationError);
    // }

    return res.status(200).json({
      success: true,
      message: "Maintenance record updated successfully",
    });
  } catch (error) {
    console.error("Error updating maintenance record:", error);
    return res.status(500).json({ error: "Failed to update maintenance record" });
  }
};

const getShiftMaintenanceController = async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(`
          SELECT 
            c.id,
            c.name,
            c.model,
            c.ip_address,
            u.servo_power_time
          FROM controller c
          LEFT JOIN (
            SELECT 
              controller_id,
              servo_power_time,
              ROW_NUMBER() OVER (PARTITION BY controller_id ORDER BY created_at DESC) as rn
            FROM utilization_data
          ) u ON c.id = u.controller_id AND u.rn = 1
          ORDER BY c.name
        `);

    // Add robot_model from system.sys files
    const controllersWithRobotModel = result.rows.map((controller) => {
      let robot_model = null;

      try {
        // Platform-agnostic base path
        const baseDir =
          process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? "C:\\Watchlog\\UI" : path.join(os.homedir(), "Watchlog", "UI"));

        const systemInfoDir = path.join(baseDir, `${controller.ip_address}_SYSTEM`);

        if (fs.existsSync(systemInfoDir)) {
          const files = fs.readdirSync(systemInfoDir);
          const systemFiles = files.filter((file) => file.toUpperCase().includes("SYSTEM") && (file.endsWith(".SYS") || file.endsWith(".sys")));

          if (systemFiles.length > 0) {
            const latestFile = systemFiles
              .map((fileName) => {
                const filePath = path.join(systemInfoDir, fileName);
                const stats = fs.statSync(filePath);
                return { fileName, filePath, mtime: stats.mtime };
              })
              .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

            const content = fs.readFileSync(latestFile.filePath, "utf8");
            const parsedInfo = parseSystemFile(content);
            robot_model = parsedInfo.robotModel || null;
          }
        }
      } catch (error) {
        console.error(`Error reading system.sys for controller ${controller.id}:`, error);
      }

      return {
        id: controller.id,
        name: controller.name,
        model: controller.model,
        robot_model,
        servo_power_time: controller.servo_power_time,
      };
    });

    return res.status(200).json(controllersWithRobotModel);
  } catch (error) {
    console.error("Error fetching controllers for maintenance:", error);
    return res.status(500).json({ error: "Failed to fetch controllers" });
  }
};

const getShiftMaintenanceHistory = async (req: Request, res: Response) => {
  const { controllerId } = req.query;
  try {
    let query = `
          SELECT 
            mh.id,
            mh.controller_id,
            mh.maintenance_type,
            mh.maintenance_date,
            mh.servo_hours,
            mh.technician,
            mh.notes,
            mh.created_at,
            c.name as controller_name,
            c.model as controller_model
          FROM maintenance_history mh
          JOIN controller c ON mh.controller_id = c.id
        `;

    const params = [];
    if (controllerId) {
      query += ` WHERE mh.controller_id = $1`;
      params.push(controllerId);
    }

    query += ` ORDER BY mh.maintenance_date DESC`;

    const result = await dbPool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching maintenance history:", error);
    return res.status(500).json({ error: "Failed to fetch maintenance history" });
  }
};

export { createShiftMaintenance, deleteShiftMaintenance, updateShiftMaintenance, getShiftMaintenanceController, getShiftMaintenanceHistory };
