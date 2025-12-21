import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { RobotRequestDto, RobotResponseDto } from "../models/robot-dto";
import { v4 as uuidv4 } from "uuid";

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

    await client.query(
      `
        WITH t AS (
          SELECT gs::text AS no FROM generate_series(0, 99) gs
        ),
        src AS (
          SELECT no, $1 AS ip, $2 AS cid FROM t
        ),
        ins_b AS (
          INSERT INTO b_read (id, ip_address, no, name, value, controller_id)
          SELECT gen_random_uuid()::text, ip, no, NULL, '0', cid FROM src
        ),
        ins_d AS (
          INSERT INTO d_read (id, ip_address, no, name, value, controller_id)
          SELECT gen_random_uuid()::text, ip, no, NULL, '0', cid FROM src
        ),
        ins_s AS (
          INSERT INTO s_read (id, ip_address, no, name, value, controller_id)
          SELECT gen_random_uuid()::text, ip, no, NULL, '0', cid FROM src
        ),
        ins_i AS (
          INSERT INTO i_read (id, ip_address, no, name, value, controller_id)
          SELECT gen_random_uuid()::text, ip, no, NULL, '0', cid FROM src
        ),
        ins_r AS (
          INSERT INTO r_read (id, ip_address, no, name, value, controller_id)
          SELECT gen_random_uuid()::text, ip, no, NULL, '0', cid FROM src
        )
        SELECT 1;
        `,
      [ipAddress, newRobotId],
    );

    await client.query(
      `
        INSERT INTO register (id, controller_id, register_no, register_value, ip_address)
        SELECT gen_random_uuid()::text, $1, gs, 0, $2
        FROM generate_series(0, 999) gs;
        `,
      [newRobotId, ipAddress],
    );

    await client.query(
      `
        WITH gdef AS (
          SELECT * FROM (
            VALUES
              ('External Input', 2001, 2512),
              ('External Output', 3001, 3512),
              ('Universal Input', 1, 512),
              ('Universal Output', 1001, 1512),
              ('Specific Input', 4001, 4160),
              ('Specific Output', 5001, 5300),
              ('Aux Relay', 7001, 7999),
              ('Control Status', 8001, 8064),
              ('Pseudo Input', 8201, 8220),
              ('Network Input', 2701, 2956),
              ('Network Output', 3701, 3956)
          ) AS t(name, start_byte, end_byte)
        ),
        ins_groups AS (
          INSERT INTO io_group (id, name, start_byte, end_byte, controller_id)
          SELECT gen_random_uuid()::text, name, start_byte, end_byte, $1
          FROM gdef
          RETURNING id, name, start_byte, end_byte
        ),
        ins_signals AS (
          INSERT INTO io_signal (id, group_id, byte_number, description)
          SELECT
            gen_random_uuid()::text,
            g.id,
            gs,
            g.name || ' #' || gs
          FROM ins_groups g
          CROSS JOIN generate_series(g.start_byte, g.end_byte) gs
          RETURNING id, byte_number
        )
        INSERT INTO io_bit (id, signal_id, bit_number, name, is_active)
        SELECT
          gen_random_uuid()::text,
          s.id,
          bit,
          s.byte_number || '_' || bit,
          false
        FROM ins_signals s
        CROSS JOIN generate_series(0, 7) bit;
        `,
      [newRobotId],
    );

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

export { getRobots, createRobot, updateRobot, deleteRobot, getRobotById };
