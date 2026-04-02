import { Request, Response } from "express";
import { dbPool } from "../config/db";
import AbsoSnapshotModel from "../models/mongo/abso-snapshot.model";
import { RobotRequestDto, RobotResponseDto } from "../models/robot-dto";
import { v4 as uuidv4 } from "uuid";
import { broadcastAndInsertNotification } from "../utils/notification";

const alarmTableMap: { [key: string]: string } = {
  detected: "alarm",
  almhist: "almhist",
};

const getRobots = async (req: Request, res: Response) => {
  try {
    const controllerDbResp = await dbPool.query(`
                SELECT
        c.id,
        c.ip_address AS "ipAddress",
        c.name,
        c.model,
        c.application,
        c.location,
        c.status,
        json_build_object(
            'alarm', ct.alarm,
            'cycle', ct.cycle,
            'doorOpen', ct.door_opened,
            'error', ct.error,
            'hold', ct.hold,
            'operating', ct.operating,
            'servo', ct.servo,
            'stop', ct.stop,
            'teach', ct.teach,
            'cBackup', ct.c_backup,
            'connection', ct.connection
        ) AS "controllerStatus"
        FROM
        controller c
            INNER JOIN controller_status ct
                ON c.id = ct.controller_id
                ORDER BY c.created_at ASC
            `);

    const controllers: RobotResponseDto[] = controllerDbResp.rows;
    return res.status(200).json(controllers);
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getRobotById = async (req: Request, res: Response) => {
  const robotId = req.params?.id;
  try {
    const dbRes = await dbPool.query(
      `SELECT
                c.id,
                c.name,
                c.model,
                c.application,
                c.ip_address AS "ipAddress",
                c.status,
                c.serial_number AS "serialNumber",
                c.interval_ms AS "intervalMs",
                c.max_connection AS "maxConnection",
                c.location,
                json_build_object(
            'alarm', ct.alarm,
            'cycle', ct.cycle,
            'doorOpen', ct.door_opened,
            'error', ct.error,
            'hold', ct.hold,
            'operating', ct.operating,
            'servo', ct.servo,
            'stop', ct.stop,
            'teach', ct.teach,
            'cBackup', ct.c_backup,
            'connection', ct.connection
        ) AS "controllerStatus"           
                FROM controller c INNER JOIN controller_status ct ON c.id=ct.controller_id WHERE c.id = $1`,
      [robotId],
    );

    if (!dbRes?.rowCount || !(dbRes.rowCount > 0)) {
      return res.status(400).json({ message: "Controller not found" });
    }
    const controller = dbRes.rows[0];
    return res.status(200).json({ ...controller });
  } catch (error: any) {
    console.log("DB Error: ", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const createRobot = async (req: Request, res: Response) => {
  const { name, model, application, ipAddress, status, serialNumber, intervalMs, maxConnection, location }: RobotRequestDto = req.body;

  const newRobotId = uuidv4();
  const newRobotStatusId = uuidv4();

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        WITH ins_controller AS (
          INSERT INTO controller (id, name, model, application, ip_address, status, serial_number, interval_ms, max_connection, location)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING id
        ),
        ins_status AS (
          INSERT INTO controller_status
            (id, ip_address, controller_id, teach, servo, operating, cycle, hold, alarm, error, stop, door_opened, c_backup, connection)
          VALUES ($11, $5, $1, 'TEACH', false, false, 'CYCLE', false, false, false, false, false, false, false)
          RETURNING id
        )
        SELECT 1;
        `,
      [newRobotId, name, model, application, ipAddress, status, serialNumber, intervalMs, maxConnection, location, newRobotStatusId],
    );

    await broadcastAndInsertNotification({
      type: "controller_added",
      title: "New Controller Added",
      message: `Controller "${name}" has been added to the system`,
      data: {
        controller_id: newRobotId,
        controller_name: name,
        severity: "info",
        timestamp: new Date().toISOString(),
      },
    })

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Controller successfully created",
      controllerId: newRobotId,
    });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateRobot = async (req: Request, res: Response) => {
  const robotId = req.params?.id;
  const { name, model, application, ipAddress, status, serialNumber, intervalMs, maxConnection, location }: RobotRequestDto = await req.body;
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE "controller" 
                SET name = $1, model = $2, application = $3, ip_address = $4, status = $5, serial_number = $6, interval_ms = $7, max_connection = $8, location = $9 
                WHERE id = $10`,
      [name, model, application, ipAddress, status, serialNumber, intervalMs, maxConnection, location, robotId],
    );
    await client.query("COMMIT");
    return res.status(200).json({ message: "Controller updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteRobot = async (req: Request, res: Response) => {
  const robotId = req.params?.id;
  console.log("deletion robot id", robotId);

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM "controller" WHERE id = $1`, [robotId]);

    await client.query("COMMIT");

    return res.status(200).json({ message: "Controller deleted successfully" });
  } catch (error: any) {
    console.error("DELETE ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Failed to delete controller" });
  } finally {
    client.release();
  }
};

const getStatusHistory = async (req: Request, res: Response) => {
  const { controllerId, shiftId, date, days } = req.query;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  let startTime = "00:00:00";
  let endTime = "23:59:59";

  try {
    if (shiftId) {
      const shiftQuery = await dbPool.query(`SELECT id, name, shift_start, shift_end FROM shift WHERE id = $1`, [shiftId]);

      if (shiftQuery.rows.length > 0) {
        startTime = shiftQuery.rows[0].shift_start;
        endTime = shiftQuery.rows[0].shift_end;
      }
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const endDate = new Date(targetDate as string | number);
    const startDate = new Date(targetDate as string | number);
    startDate.setDate(startDate.getDate() - parseInt(days as string) + 1);

    const shiftCrossesMidnight = startTime > endTime;

    let historyQuery;
    if (shiftCrossesMidnight) {
      const queryParams = [controllerId, startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0], startTime, endTime];

      historyQuery = await dbPool.query(
        `
        SELECT 
          id,
          controller_id,
          teach,
          servo,
          operating,
          cycle,
          hold,
          alarm,
          error,
          stop,
          door_opened,
          c_backup,
          connection,
          created_at
        FROM controller_status_history
        WHERE controller_id = $1
          AND created_at::date >= $2::date
          AND created_at::date <= $3::date
          AND (
            created_at::time >= $4::time
            OR
            created_at::time <= $5::time
          )
        ORDER BY created_at ASC
        `,
        queryParams,
      );
    } else {
      const queryParams = [controllerId, startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0], startTime, endTime];

      historyQuery = await dbPool.query(
        `
        SELECT 
          id,
          controller_id,
          teach,
          servo,
          operating,
          cycle,
          hold,
          alarm,
          error,
          stop,
          door_opened,
          c_backup,
          connection,
          created_at
        FROM controller_status_history
        WHERE controller_id = $1
          AND created_at::date >= $2::date
          AND created_at::date <= $3::date
          AND created_at::time >= $4::time
          AND created_at::time <= $5::time
        ORDER BY created_at ASC
        `,
        queryParams,
      );
    }

    const records = historyQuery.rows;
    const statusDurations = {
      operating: 0,
      stop: 0,
      alarm: 0,
      error: 0,
      hold: 0,
      idle: 0,
      servo_off: 0,
      disconnect: 0,
    };

    const hourlyData: { [hour: string]: typeof statusDurations } = {};
    const dailyData: { [day: string]: typeof statusDurations } = {};

    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      return hours * 60 + minutes + (seconds || 0) / 60;
    };

    const isTimeInShift = (timeMinutes: number, shiftStartMinutes: number, shiftEndMinutes: number, crossesMidnight: boolean): boolean => {
      if (crossesMidnight) {
        return timeMinutes >= shiftStartMinutes || timeMinutes <= shiftEndMinutes;
      } else {
        return timeMinutes >= shiftStartMinutes && timeMinutes <= shiftEndMinutes;
      }
    };

    const shiftStartMinutes = timeToMinutes(startTime);
    const shiftEndMinutes = timeToMinutes(endTime);

    const MAX_DURATION_MINUTES = 120;

    for (let i = 0; i < records.length - 1; i++) {
      const current = records[i];
      const next = records[i + 1];

      const currentTime = new Date(current.created_at);
      const nextTime = new Date(next.created_at);

      let duration = (nextTime.getTime() - currentTime.getTime()) / 1000 / 60;

      if (duration > MAX_DURATION_MINUTES) {
        continue;
      }

      const currentTimeStr = currentTime.toTimeString().slice(0, 8);
      const nextTimeStr = nextTime.toTimeString().slice(0, 8);
      const currentMinutes = timeToMinutes(currentTimeStr);
      const nextMinutes = timeToMinutes(nextTimeStr);

      const currentInShift = isTimeInShift(currentMinutes, shiftStartMinutes, shiftEndMinutes, shiftCrossesMidnight);

      if (!currentInShift) {
        continue;
      }

      const nextInShift = isTimeInShift(nextMinutes, shiftStartMinutes, shiftEndMinutes, shiftCrossesMidnight);

      if (!nextInShift) {
        if (shiftCrossesMidnight) {
          if (currentMinutes > shiftEndMinutes) {
            const minutesUntilShiftEnd = 24 * 60 - currentMinutes + shiftEndMinutes;
            duration = Math.min(duration, minutesUntilShiftEnd);
          } else {
            duration = Math.min(duration, shiftEndMinutes - currentMinutes);
          }
        } else {
          duration = Math.min(duration, shiftEndMinutes - currentMinutes);
        }

        if (duration <= 0) {
          continue;
        }
      }

      let status: keyof typeof statusDurations = "idle";
      if (!current.connection) {
        status = "disconnect";
      } else if (!current.servo) {
        status = "servo_off";
      } else if (current.alarm) {
        status = "alarm";
      } else if (current.error) {
        status = "error";
      } else if (current.operating) {
        status = "operating";
      } else if (current.stop) {
        status = "stop";
      } else if (current.hold) {
        status = "hold";
      }

      statusDurations[status] += duration;

      const currentDate = new Date(current.created_at);
      const hour = currentDate
        .toLocaleString("en-US", {
          hour: "2-digit",
          hour12: false,
          timeZone: "Europe/Istanbul",
        })
        .padStart(2, "0");

      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          operating: 0,
          stop: 0,
          alarm: 0,
          error: 0,
          hold: 0,
          idle: 0,
          servo_off: 0,
          disconnect: 0,
        };
      }
      hourlyData[hour][status] += duration;

      const day = currentDate.toLocaleDateString("en-CA", {
        timeZone: "Europe/Istanbul",
      });

      if (!dailyData[day]) {
        dailyData[day] = {
          operating: 0,
          stop: 0,
          alarm: 0,
          error: 0,
          hold: 0,
          idle: 0,
          servo_off: 0,
          disconnect: 0,
        };
      }
      dailyData[day][status] += duration;
    }

    const totalTime = Object.values(statusDurations).reduce((sum, val) => sum + val, 0);
    const operatingRate = totalTime > 0 ? (statusDurations.operating / totalTime) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        statusDurations,
        operatingRate: operatingRate.toFixed(2),
        hourlyData: Object.entries(hourlyData).map(([hour, durations]) => ({
          hour: `${hour}:00`,
          ...durations,
        })),
        dailyData: Object.entries(dailyData).map(([day, durations]) => ({
          date: day,
          ...durations,
        })),
        totalRecords: records.length,
      },
    });
  } catch (error) {
    console.error("Error fetching status history:", error);
    return res.status(500).json({ error: "Failed to fetch status history" });
  }
};

const getStatus = async (req: Request, res: Response) => {
  const { controllerId } = req.query;

  if (!controllerId) {
    return res.status(400).json({ error: "Controller ID is required" });
  }

  try {
    const result = await dbPool.query(
      `
      SELECT 
        teach,
        servo,
        operating,
        cycle,
        hold,
        alarm,
        error,
        stop,
        door_opened,
        c_backup,
        connection,
        update_at
      FROM controller_status
      WHERE controller_id = $1
      `,
      [controllerId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Controller status not found" });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching controller status:", error);
    return res.status(500).json({ error: "Failed to fetch controller status" });
  }
};

const getAlarmsWithTypeByControllerId = async (req: Request, res: Response) => {
  const { controllerId, types } = req.params;
  const { type } = req.query;
  const tableName = alarmTableMap[types];

  if (!tableName) {
    return res.status(400).json({ message: `Invalid alarm type: ${types}` });
  }

  try {
    if (types === "almhist") {
      // ALMHIST migrated to MongoDB - use /system-expectations/alarm-logs/:controllerId?type=
      return res.status(200).json([]);
    }

    const dbRes = await dbPool.query(
      `SELECT 
         code, 
         alarm, 
         detected, 
         removed, 
         text, 
         origin_date AS "originDate"
       FROM ${tableName}
       WHERE controller_id = $1 AND is_active = true
       ORDER BY origin_date DESC`,
      [controllerId],
    );

    if (dbRes?.rowCount && dbRes.rowCount > 0) {
      return res.status(200).json(dbRes.rows);
    }

    return res.status(404).json({ message: "No alarms found" });
  } catch (error) {
    console.error("DB Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAbsoDataWithControllerId = async (req: Request, res: Response) => {
  const { controllerId } = req.params;

  try {
    const doc = await AbsoSnapshotModel.findOne({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    if (!doc) {
      return res.status(200).json([]);
    }

    const r1 = doc.currValue?.R1 ?? {};
    const row = {
      id: String(doc._id),
      controller_id: doc.controllerId,
      timestamp: doc.recordedAt
        ? new Date(doc.recordedAt).toISOString()
        : new Date().toISOString(),
      S: r1.S ?? 0,
      L: r1.L ?? 0,
      U: r1.U ?? 0,
      R: r1.R ?? 0,
      B: r1.B ?? 0,
      T: r1.T ?? 0,
    };

    return res.status(200).json([row]);
  } catch (error) {
    console.error("Error fetching abso data:", error);
    return res.status(500).json({ error: "Failed to fetch abso data" });
  }
};

const getBackupFiles = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;
    const { date } = req.query;

    let query = `
      SELECT 
        id, controller_id, plan_id, file_name, file_type,
        size, hash, path, backup_date, status, error_message, created_at
      FROM backup_files 
      WHERE controller_id = $1
    `;

    const queryParams: (string | undefined)[] = [controllerId];
    if (date) {
      query += ` AND DATE(backup_date) = DATE($2)`;
      queryParams.push(date as string);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await dbPool.query(query, queryParams);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching backup files:", error);
    return res.status(500).json({ error: "Failed to fetch backup files" });
  }
};

const deleteBackupFile = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.params;
    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    const query = `
      DELETE FROM backup_files
      WHERE controller_id = $1 AND id = $2
      RETURNING *
    `;

    const result = await dbPool.query(query, [controllerId, fileId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting backup file:", error);
    return res.status(500).json({ error: "Failed to delete backup file" });
  }
};

const createAlarm = async (req: Request, res: Response) => {
  const { controllerId } = req.params;
  const { code, text, alarm_type = "MAJOR", is_active = true } = req.body;

  if (!code || !text) {
    return res.status(400).json({ message: "Code and text are required" });
  }

  const client = await dbPool.connect();

  try {
    const alarmId = uuidv4();
    const originDate = new Date().toISOString();

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO alarm (id, controller_id, code, text, detected, origin_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [alarmId, controllerId, code, text, originDate, originDate, is_active],
    );

    await client.query(
      `INSERT INTO almhist (id, controller_id, code, name, origin_date, mode, type)
       VALUES ($1, $2, $3, $4, $5, 'DETECTED', $6)`,
      [uuidv4(), controllerId, code, text, originDate, alarm_type],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Alarm triggered successfully",
      alarm_id: alarmId,
      controller_id: controllerId,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

export {
  getRobots,
  createRobot,
  updateRobot,
  deleteRobot,
  getRobotById,
  getStatusHistory,
  getStatus,
  getAlarmsWithTypeByControllerId,
  getAbsoDataWithControllerId,
  getBackupFiles,
  deleteBackupFile,
  createAlarm,
};
