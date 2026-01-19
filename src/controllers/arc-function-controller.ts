import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { getMachineConfigByName } from "../utils/machine-config";

const getArcFunctions = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.query;

    let query = `
      SELECT 
        af.id,
        af.controller_id as "controllerId",
        af.ip_address as "ipAddress",
        af.factory,
        af.line,
        af.cell,
        af.part_serial_id as "partSerialId",
        af.part_item_number as "partItemNumber",
        af.part_version as "partVersion",
        af.seam_number as "seamNumber",
        af.set_voltage as "setVoltage",
        af.set_current as "setCurrent",
        af.actual_voltage as "actualVoltage",
        af.actual_current as "actualCurrent",
        af.wire_speed as "wireSpeed",
        af.motor_torque_m1 as "motorTorqueM1",
        af.motor_torque_m2 as "motorTorqueM2",
        af.actual_gas_flow as "actualGasFlow",
        af.machine_name as "machineName",
        af.machine_type as "machineType",
        af.is_active as "isActive",
        af.created_at as "createdAt",
        af.updated_at as "updatedAt",
        af.job_names as "jobNames",
        af.part_item_numbers as "partItemNumbers",
        c.name as "controllerName",
        af.factory as "factoryName",
        af.line as "lineName",
        af.cell as "cellName"
      FROM arc_function af
      LEFT JOIN controller c ON af.controller_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (controllerId) {
      query += ` AND af.controller_id = $1`;
      params.push(controllerId);
    }

    query += ` ORDER BY af.created_at DESC`;

    const result = await dbPool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error("Error fetching arc functions:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getArcFunctionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `SELECT 
        af.id,
        af.controller_id as "controllerId",
        af.ip_address as "ipAddress",
        af.factory,
        af.line,
        af.cell,
        af.part_serial_id as "partSerialId",
        af.part_item_number as "partItemNumber",
        af.part_version as "partVersion",
        af.seam_number as "seamNumber",
        af.set_voltage as "setVoltage",
        af.set_current as "setCurrent",
        af.actual_voltage as "actualVoltage",
        af.actual_current as "actualCurrent",
        af.wire_speed as "wireSpeed",
        af.motor_torque_m1 as "motorTorqueM1",
        af.motor_torque_m2 as "motorTorqueM2",
        af.actual_gas_flow as "actualGasFlow",
        af.machine_name as "machineName",
        af.machine_type as "machineType",
        af.is_active as "isActive",
        af.created_at as "createdAt",
        af.updated_at as "updatedAt",
        af.job_names as "jobNames",
        af.part_item_numbers as "partItemNumbers",
        c.name as "controllerName",
        c.ip_address as "controllerIpAddress",
        af.factory as "factoryName",
        af.line as "lineName",
        af.cell as "cellName"
      FROM arc_function af
      LEFT JOIN controller c ON af.controller_id = c.id
      WHERE af.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Arc function not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching arc function:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createArcFunction = async (req: Request, res: Response) => {
  try {
    const {
      machineType,
      machineName,
      controllerId,
      ipAddress,
      factory,
      line,
      cell,
      isActive = true,
      jobNames = [],
      partItemNumbers = [],
      partSerialId = null,
    } = req.body;

    if (!controllerId) {
      return res.status(400).json({ message: "Missing required field: controllerId" });
    }

    if (!machineName) {
      return res.status(400).json({ message: "Missing required field: machineName" });
    }

    const machineConfig = getMachineConfigByName(machineName);
    const registers = machineConfig?.registers || {};

    const id = uuidv4();

    const columns = [
      "id",
      "controller_id",
      "ip_address",
      "factory",
      "line",
      "cell",
      "machine_name",
      "machine_type",
      "is_active",
      "job_names",
      "part_item_numbers",
      "part_serial_id",
    ];
    const values = [id, controllerId, ipAddress, factory, line, cell, machineName, machineType, isActive, jobNames, partItemNumbers, partSerialId];

    if (registers.setVoltage !== undefined) {
      columns.push("set_voltage");
      values.push(registers.setVoltage);
    }
    if (registers.setCurrent !== undefined) {
      columns.push("set_current");
      values.push(registers.setCurrent);
    }
    if (registers.actualVoltage !== undefined) {
      columns.push("actual_voltage");
      values.push(registers.actualVoltage);
    }
    if (registers.actualCurrent !== undefined) {
      columns.push("actual_current");
      values.push(registers.actualCurrent);
    }
    if (registers.wireSpeed !== undefined) {
      columns.push("wire_speed");
      values.push(registers.wireSpeed);
    }
    if (registers.motorTorqueM1 !== undefined) {
      columns.push("motor_torque_m1");
      values.push(registers.motorTorqueM1);
    }
    if (registers.motorTorqueM2 !== undefined) {
      columns.push("motor_torque_m2");
      values.push(registers.motorTorqueM2);
    }
    if (registers.actualGasFlow !== undefined) {
      columns.push("actual_gas_flow");
      values.push(registers.actualGasFlow);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      INSERT INTO arc_function (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING 
        id,
        controller_id as "controllerId",
        ip_address as "ipAddress",
        factory,
        line,
        cell,
        part_serial_id as "partSerialId",
        part_item_number as "partItemNumber",
        part_version as "partVersion",
        seam_number as "seamNumber",
        set_voltage as "setVoltage",
        set_current as "setCurrent",
        actual_voltage as "actualVoltage",
        actual_current as "actualCurrent",
        wire_speed as "wireSpeed",
        motor_torque_m1 as "motorTorqueM1",
        motor_torque_m2 as "motorTorqueM2",
        actual_gas_flow as "actualGasFlow",
        machine_name as "machineName",
        machine_type as "machineType",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt",
        job_names as "jobNames",
        part_item_numbers as "partItemNumbers"
    `;

    const result = await dbPool.query(query, values);

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating arc function:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateArcFunction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { machineName, machineType, controllerId, ipAddress, factory, line, cell, isActive, jobNames, partItemNumbers, partSerialId } = req.body;

    // Check if record exists
    const checkResult = await dbPool.query("SELECT id FROM arc_function WHERE id = $1", [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Arc function not found" });
    }

    const machineConfig = machineName ? getMachineConfigByName(machineName) : undefined;
    const registers = machineConfig?.registers || {};

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (controllerId !== undefined) {
      updates.push(`controller_id = $${paramIndex++}`);
      values.push(controllerId);
    }
    if (ipAddress !== undefined) {
      updates.push(`ip_address = $${paramIndex++}`);
      values.push(ipAddress);
    }
    if (factory !== undefined) {
      updates.push(`factory = $${paramIndex++}`);
      values.push(factory);
    }
    if (line !== undefined) {
      updates.push(`line = $${paramIndex++}`);
      values.push(line);
    }
    if (cell !== undefined) {
      updates.push(`cell = $${paramIndex++}`);
      values.push(cell);
    }
    if (machineName !== undefined) {
      updates.push(`machine_name = $${paramIndex++}`);
      values.push(machineName);
    }
    if (machineType !== undefined) {
      updates.push(`machine_type = $${paramIndex++}`);
      values.push(machineType);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    if (jobNames !== undefined) {
      updates.push(`job_names = $${paramIndex++}`);
      values.push(jobNames);
    }
    if (partItemNumbers !== undefined) {
      updates.push(`part_item_numbers = $${paramIndex++}`);
      values.push(partItemNumbers);
    }
    if (partSerialId !== undefined) {
      updates.push(`part_serial_id = $${paramIndex++}`);
      values.push(partSerialId);
    }

    if (machineName !== undefined) {
      updates.push(`set_voltage = $${paramIndex++}`);
      values.push(registers.setVoltage ?? null);

      updates.push(`set_current = $${paramIndex++}`);
      values.push(registers.setCurrent ?? null);

      updates.push(`actual_voltage = $${paramIndex++}`);
      values.push(registers.actualVoltage ?? null);

      updates.push(`actual_current = $${paramIndex++}`);
      values.push(registers.actualCurrent ?? null);

      updates.push(`wire_speed = $${paramIndex++}`);
      values.push(registers.wireSpeed ?? null);

      updates.push(`motor_torque_m1 = $${paramIndex++}`);
      values.push(registers.motorTorqueM1 ?? null);

      updates.push(`motor_torque_m2 = $${paramIndex++}`);
      values.push(registers.motorTorqueM2 ?? null);

      updates.push(`actual_gas_flow = $${paramIndex++}`);
      values.push(registers.actualGasFlow ?? null);
    }

    updates.push("updated_at = now()");

    values.push(id);

    const query = `
      UPDATE arc_function
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        controller_id as "controllerId",
        ip_address as "ipAddress",
        factory,
        line,
        cell,
        part_serial_id as "partSerialId",
        part_item_number as "partItemNumber",
        part_version as "partVersion",
        seam_number as "seamNumber",
        set_voltage as "setVoltage",
        set_current as "setCurrent",
        actual_voltage as "actualVoltage",
        actual_current as "actualCurrent",
        wire_speed as "wireSpeed",
        motor_torque_m1 as "motorTorqueM1",
        motor_torque_m2 as "motorTorqueM2",
        actual_gas_flow as "actualGasFlow",
        machine_name as "machineName",
        machine_type as "machineType",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt",
        job_names as "jobNames",
        part_item_numbers as "partItemNumbers"
    `;

    const result = await dbPool.query(query, values);

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating arc function:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteArcFunction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query("DELETE FROM arc_function WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Arc function not found" });
    }

    return res.status(200).json({ message: "Arc function deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting arc function:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { getArcFunctions, getArcFunctionById, createArcFunction, updateArcFunction, deleteArcFunction };
