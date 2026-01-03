import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { getSystemAlarmDetailFromCSV } from "../utils/alarm-error-logs";
import { v4 as uuidv4 } from "uuid";

const getAlarmLogDetailByIdAndCode = async (req: Request, res: Response) => {
  const { controllerId, code: alarmCode } = req.query;

  if (!controllerId || !alarmCode) {
    return res.status(400).json({ message: "Missing controllerId or code parameter" });
  }

  try {
    const controllerRes = await dbPool.query(`SELECT model FROM controller WHERE id = $1`, [controllerId]);

    if (controllerRes.rowCount === 0) {
      return res.status(404).json({ message: "Controller not found" });
    }

    const robotModel = controllerRes.rows[0].model;

    const alarmDetail = await getSystemAlarmDetailFromCSV(robotModel, alarmCode as string);

    if (!alarmDetail) {
      return res.status(404).json({ message: "System alarm detail not found" });
    }

    return res.status(200).json(alarmDetail);
  } catch (error) {
    console.error("Error fetching system alarm detail:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createWorkOrder = async (req: Request, res: Response) => {
  const { controllerId, alarmCode, description, priority = "MEDIUM", type = "CORRECTIVE" } = req.body;

  if (!controllerId || !alarmCode || !description) {
    return res.status(400).json({ message: "Controller ID, alarm code, and description are required" });
  }

  const client = await dbPool.connect();

  try {
    const createdDate = new Date().toISOString();

    const workOrderId = uuidv4();

    const workOrder = await client.query(
      `INSERT INTO work_orders (
        id, controller_id, alarm_code, description, priority, status, created_date
      ) VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)
      RETURNING *`,
      [workOrderId, controllerId, alarmCode, description, priority, createdDate],
    );

    return res.status(201).json({
      message: "System work order created successfully",
      workOrder: workOrder.rows[0],
    });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getWorkOrders = async (req: Request, res: Response) => {
  const { page, pageSize } = req.query;

  const numberPage = parseInt((page as string) || "1");
  const numberPageSize = parseInt((pageSize as string) || "10");
  const offset = (numberPage - 1) * numberPageSize;

  const client = await dbPool.connect();

  try {
    const workOrdersResult = await client.query(
      `SELECT 
        wo.*,
        c.name as controller_name,
        c.ip_address as controller_ip
       FROM work_orders wo
       LEFT JOIN controller c ON wo.controller_id = c.id
       ORDER BY wo.created_date DESC
       LIMIT $1 OFFSET $2`,
      [numberPage, offset],
    );

    const countResult = await client.query(`SELECT COUNT(*) as total FROM work_orders`);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / numberPageSize);

    return res.status(200).json({
      workOrders: workOrdersResult.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Work orders fetch error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteWorkOrder = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;

  if (!workOrderId) {
    return res.status(400).json({ message: "Work Order ID is required" });
  }

  const client = await dbPool.connect();

  try {
    const checkResult = await client.query(`SELECT id FROM work_orders WHERE id = $1`, [workOrderId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Work order not found" });
    }

    await client.query(`DELETE FROM work_orders WHERE id = $1`, [workOrderId]);

    return res.status(200).json({ message: "Work order deleted successfully" });
  } catch (error: any) {
    console.error("Work order delete error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export { getAlarmLogDetailByIdAndCode, createWorkOrder, getWorkOrders, deleteWorkOrder };
