import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { LineHierarchy } from "../models/home-dto";

const getHierarchy = async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(
      `SELECT 
        l.id as line_id,
        l.name as line_name,
        l.status as line_status,
        COALESCE(f.name, 'Unknown Factory') as factory_name,
        c.id as cell_id,
        c.name as cell_name,
        c.status as cell_status,
        c.line_id,
        ctrl.id as controller_id,
        ctrl.name as controller_name,
        ctrl.model as controller_model,
        ctrl.application as controller_application,
        ctrl.ip_address as controller_ip_address,
        ctrl.status as controller_status,
        ctrl.location as controller_location
      FROM line l
      LEFT JOIN factory f ON l.factory_id = f.id
      LEFT JOIN cell c ON c.line_id = l.id
      LEFT JOIN controller ctrl ON ctrl.location = CONCAT(f.name, '/', l.name, '/', c.name)
      ORDER BY l.name, c.name, ctrl.name`,
    );

    const linesMap = new Map<string, LineHierarchy>();

    for (const row of result.rows) {
      if (!row || !row.line_id) continue;

      if (!linesMap.has(row.line_id)) {
        linesMap.set(row.line_id, {
          id: row.line_id,
          name: row.line_name || "Unknown Line",
          status: row.line_status || "unknown",
          factoryName: row.factory_name || "Unknown Factory",
          cells: [],
        });
      }

      const line = linesMap.get(row.line_id);
      if (!line) continue;

      if (row.cell_id) {
        let cell = line.cells.find((c) => c && c.id === row.cell_id);
        if (!cell) {
          cell = {
            id: row.cell_id,
            name: row.cell_name || "Unknown Cell",
            status: row.cell_status || "unknown",
            lineId: row.line_id,
            controllers: [],
          };
          line.cells.push(cell);
        }

        if (row.controller_id && cell.controllers && Array.isArray(cell.controllers)) {
          const exists = cell.controllers.some((ctrl) => ctrl && ctrl.id === row.controller_id);
          if (!exists) {
            cell.controllers.push({
              id: row.controller_id,
              name: row.controller_name || "Unknown Controller",
              model: row.controller_model,
              application: row.controller_application,
              ipAddress: row.controller_ip_address,
              status: row.controller_status || "unknown",
              location: row.controller_location,
            });
          }
        }
      }
    }

    const lines = Array.from(linesMap.values());

    return res.status(200).json(lines);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export { getHierarchy };
