import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

export type TcpPoseTriggerConfigRow = {
  id: string;
  controller_id: string;
  signal_general_no: string;
  reg_x: string;
  reg_y: string;
  reg_z: string;
  reg_rx: string;
  reg_ry: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export const getTcpPoseTriggerConfig = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  try {
    const r = await dbPool.query(
      `SELECT id, controller_id, signal_general_no, reg_x, reg_y, reg_z, reg_rx, reg_ry, enabled, created_at, updated_at
       FROM tcp_pose_trigger_config WHERE controller_id = $1`,
      [controllerId],
    );
    if (r.rowCount === 0) {
      return res.status(200).json(null);
    }
    return res.status(200).json(r.rows[0] as TcpPoseTriggerConfigRow);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "error";
    console.error("getTcpPoseTriggerConfig:", msg);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertTcpPoseTriggerConfig = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const {
    signalGeneralNo,
    regX,
    regY,
    regZ,
    regRx,
    regRy,
    enabled = true,
  } = req.body ?? {};

  if (
    signalGeneralNo === undefined ||
    signalGeneralNo === "" ||
    regX === undefined ||
    regX === "" ||
    regY === undefined ||
    regY === "" ||
    regZ === undefined ||
    regZ === "" ||
    regRx === undefined ||
    regRx === "" ||
    regRy === undefined ||
    regRy === ""
  ) {
    return res.status(400).json({ message: "All register fields and signal number are required" });
  }

  const id = uuidv4();
  try {
    await dbPool.query(
      `INSERT INTO tcp_pose_trigger_config (
        id, controller_id, signal_general_no, reg_x, reg_y, reg_z, reg_rx, reg_ry, enabled, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (controller_id) DO UPDATE SET
        signal_general_no = EXCLUDED.signal_general_no,
        reg_x = EXCLUDED.reg_x,
        reg_y = EXCLUDED.reg_y,
        reg_z = EXCLUDED.reg_z,
        reg_rx = EXCLUDED.reg_rx,
        reg_ry = EXCLUDED.reg_ry,
        enabled = EXCLUDED.enabled,
        updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        controllerId,
        String(signalGeneralNo).trim(),
        String(regX).trim(),
        String(regY).trim(),
        String(regZ).trim(),
        String(regRx).trim(),
        String(regRy).trim(),
        Boolean(enabled),
      ],
    );

    const sigNo = String(signalGeneralNo).trim();
    const seed = await dbPool.query(
      `SELECT id FROM general_signal_data WHERE controller_id = $1 AND general_no = $2`,
      [controllerId, sigNo],
    );
    if (seed.rowCount === 0) {
      await dbPool.query(
        `INSERT INTO general_signal_data (id, controller_id, general_no, value, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [uuidv4(), controllerId, sigNo, false],
      );
    }

    const r = await dbPool.query(
      `SELECT id, controller_id, signal_general_no, reg_x, reg_y, reg_z, reg_rx, reg_ry, enabled, created_at, updated_at
       FROM tcp_pose_trigger_config WHERE controller_id = $1`,
      [controllerId],
    );
    return res.status(200).json(r.rows[0]);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "error";
    console.error("upsertTcpPoseTriggerConfig:", msg);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTcpPoseTriggerLogs = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
  try {
    const r = await dbPool.query(
      `SELECT id, controller_id, captured_at, trigger_signal_no, x, y, z, rx, ry, rz
       FROM tcp_pose_trigger_log
       WHERE controller_id = $1
       ORDER BY captured_at DESC
       LIMIT $2`,
      [controllerId, limit],
    );
    return res.status(200).json(r.rows);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "error";
    console.error("getTcpPoseTriggerLogs:", msg);
    return res.status(500).json({ message: "Internal server error" });
  }
};
