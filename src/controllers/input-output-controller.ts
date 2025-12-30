import { Request, Response } from "express";
import { dbPool } from "../config/db";

const getInputOutput = async (req: Request, res: Response) => {
  const { controllerId, type } = req.params;
  const { byte } = req.query;

  const typeMap: { [key: string]: string } = {
    extInput: "External Input",
    extOutput: "External Output",
    univInput: "Universal Input",
    univOutput: "Universal Output",
    spesInput: "Specific Input",
    spesOutput: "Specific Output",
    interPanel: "Interface Panel",
    auxRel: "Auxiliary Relay",
    contStat: "Control Status",
    pseInput: "Pseudo Input",
    netInput: "Network Input",
    netOutput: "Network Output",
    register: "Registers",
  };

  const mappedType = typeMap[type];
  if (!mappedType) {
    return res.status(400).json({ message: "Invalid type parameter" });
  }

  try {
    const selectedByte = byte;
    const groupRes = await dbPool.query(`SELECT * FROM io_group WHERE controller_id = $1 AND name = $2`, [controllerId, mappedType]);

    if (groupRes.rowCount === 0) {
      return res.status(404).json({ message: "No groups found for the given type" });
    }

    const group = groupRes.rows[0];

    const queryParams = selectedByte ? [group.id, selectedByte] : [group.id];

    const signalRes = await dbPool.query(
      `
      SELECT 
        s.id AS "signalId",
        s.byte_number AS "signalBitNumber",
        s.description AS "name",
        b.bit_number AS "bitNumber",
        b.name AS "bitName",
        b.is_active AS "isActive"
      FROM io_signal AS s
      LEFT JOIN io_bit AS b ON s.id = b.signal_id
      WHERE s.group_id = $1
      ${selectedByte ? `AND s.byte_number = $2` : ""}
      ORDER BY s.byte_number, b.bit_number
      `,
      queryParams,
    );

    const signals = signalRes.rows.reduce((acc: any[], row) => {
      const byteNumber = row.signalBitNumber?.toString() || "";

      let signal = acc.find((s) => s.signalBitNumber === row.signalBitNumber);
      if (!signal) {
        signal = {
          signalBitNumber: row.signalBitNumber,
          displayByte: `${byteNumber}X`,
          name: row.name,
          bits: [],
        };
        acc.push(signal);
      }

      if (row.bitNumber !== null) {
        signal.bits.push({
          bitNumber: row.bitNumber,
          name: row.bitName,
          isActive: row.isActive,
        });
      }

      return acc;
    }, []);

    return res.status(200).json(signals);
  } catch (error) {
    console.error("DB Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export { getInputOutput };
