import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { getSystemAlarmDetailFromCSV } from "../utils/alarm-error-logs";

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

export { getAlarmLogDetailByIdAndCode };
