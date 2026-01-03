import { Request, Response } from "express";
import { dbPool } from "../config/db";

interface AlarmStats {
  hourlyData: { hour: string; count: number }[];
}

const getAlarmStats = async (req: Request, res: Response) => {
  try {
    const hourlyResult = await dbPool.query(`
          SELECT 
            TO_CHAR(origin_date::timestamp, 'HH24:00') as hour,
            COUNT(*) as count
          FROM almhist
          WHERE origin_date::timestamp >= NOW() - INTERVAL '24 hours'
          GROUP BY TO_CHAR(origin_date::timestamp, 'HH24:00')
          ORDER BY hour
        `);

    const stats: AlarmStats = {
      hourlyData: hourlyResult.rows.map((row) => ({
        hour: row.hour,
        count: parseInt(row.count),
      })),
    };

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error("Alarm stats error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getDebug = async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(`
          SELECT 
            c.id,
            c.name,
            c.status as controller_status,
            cs.connection,
            cs.servo,
            cs.operating,
            cs.alarm
          FROM controller c
          LEFT JOIN controller_status cs ON c.id = cs.controller_id
          ORDER BY c.name
        `);

    return res.status(200).json({
      success: true,
      controllers: result.rows,
      summary: {
        total: result.rows.length,
        activeByStatus: result.rows.filter((r: any) => r.controller_status?.toLowerCase() === "active").length,
        withConnection: result.rows.filter((r: any) => r.connection === true).length,
        withServo: result.rows.filter((r: any) => r.servo === true).length,
        withAlarm: result.rows.filter((r: any) => r.alarm === true).length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export interface ControllerPerformance {
  id: string;
  name: string;
  operatingRate: number;
  runningTime: string;
  alarmCount: number;
  latestAlarm?: {
    code: string;
    name: string;
  };
}

export interface PerformanceSummary {
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  averageOperatingRate: number;
  totalRunningTime: string;
  totalAlarmCount: number;
  averageCycleTime: string;
  bestPerformingController?: {
    id: string;
    name: string;
    operatingRate: number;
  };
  controllerPerformances: ControllerPerformance[];
  period: "current_shift" | "last_24h";
}

const getPerformance = async (req: Request, res: Response) => {
  const { period, shift_id: shiftId } = req.query;
  try {
    if (shiftId && shiftId !== "current" && shiftId !== "last_24h") {
      const shiftResult = await dbPool.query(
        `SELECT 
              id,
              name,
              shift_start,
              shift_end
            FROM shift
            WHERE id = $1 AND deleted_at IS NULL
            LIMIT 1`,
        [shiftId],
      );

      const shift = shiftResult.rows[0];

      if (shift) {
        const shiftCrossesMidnight = shift.shift_start > shift.shift_end;
        const today = new Date().toISOString().split("T")[0];

        let whereClause = `csh.created_at::date = $1::date 
              AND csh.created_at::time >= $2::time 
              AND csh.created_at::time <= $3::time`;

        if (shiftCrossesMidnight) {
          whereClause = `csh.created_at::date = $1::date 
                AND (csh.created_at::time >= $2::time OR csh.created_at::time <= $3::time)`;
        }

        const performanceResult = await dbPool.query(
          `SELECT 
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as avg_operating_rate,
                SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as total_running_minutes,
                COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.controller_id END) as total_alarm_count,
                COUNT(DISTINCT csh.controller_id) as total_controllers
              FROM controller_status_history csh
              WHERE ${whereClause}`,
          [today, shift.shift_start, shift.shift_end],
        );

        const perf = performanceResult.rows[0];

        const runningMinutes = parseFloat(perf.total_running_minutes) || 0;
        const hours = Math.floor(runningMinutes / 60);
        const minutes = Math.floor(runningMinutes % 60);
        const totalRunningTime = `${hours}h ${minutes}m`;

        const bestControllerResult = await dbPool.query(
          `SELECT 
                c.id,
                c.name,
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate
              FROM controller c
              INNER JOIN controller_status_history csh ON c.id = csh.controller_id
              WHERE ${whereClause}
              GROUP BY c.id, c.name
              HAVING COUNT(*) > 0
              ORDER BY operating_rate DESC
              LIMIT 1`,
          [today, shift.shift_start, shift.shift_end],
        );

        const bestController = bestControllerResult.rows[0];

        const allControllersResult = await dbPool.query(
          `SELECT 
                c.id,
                c.name,
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate,
                SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as running_minutes,
                COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.id END) as alarm_count
              FROM controller c
              LEFT JOIN controller_status_history csh ON c.id = csh.controller_id AND ${whereClause}
              GROUP BY c.id, c.name
              ORDER BY operating_rate DESC`,
          [today, shift.shift_start, shift.shift_end],
        );

        const controllerPerformances: ControllerPerformance[] = allControllersResult.rows.map((row) => {
          const runningMinutes = parseFloat(row.running_minutes) || 0;
          const hours = Math.floor(runningMinutes / 60);
          const minutes = Math.floor(runningMinutes % 60);
          return {
            id: row.id,
            name: row.name,
            operatingRate: parseFloat(row.operating_rate) || 0,
            runningTime: `${hours}h ${minutes}m`,
            alarmCount: parseInt(row.alarm_count) || 0,
          };
        });

        const summary: PerformanceSummary = {
          shiftName: shift.name,
          shiftStartTime: shift.shift_start,
          shiftEndTime: shift.shift_end,
          averageOperatingRate: parseFloat(perf.avg_operating_rate) || 0,
          totalRunningTime: totalRunningTime,
          totalAlarmCount: parseInt(perf.total_alarm_count) || 0,
          averageCycleTime: "N/A",
          bestPerformingController: bestController
            ? {
                id: bestController.id,
                name: bestController.name,
                operatingRate: parseFloat(bestController.operating_rate) || 0,
              }
            : undefined,
          controllerPerformances,
          period: "current_shift",
        };

        return res.status(200).json(summary);
      }
    }

    if (period === "current_shift") {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);

      const shiftResult = await dbPool.query(
        `SELECT 
              id,
              name,
              shift_start,
              shift_end
            FROM shift
            WHERE deleted_at IS NULL
              AND (
                (shift_start <= shift_end AND $1 >= shift_start AND $1 <= shift_end)
                OR
                (shift_start > shift_end AND ($1 >= shift_start OR $1 <= shift_end))
              )
            LIMIT 1`,
        [currentTime],
      );

      const shift = shiftResult.rows[0];

      if (shift) {
        const shiftCrossesMidnight = shift.shift_start > shift.shift_end;
        const today = now.toISOString().split("T")[0];

        let whereClause = `csh.created_at::date = $1::date 
              AND csh.created_at::time >= $2::time 
              AND csh.created_at::time <= $3::time`;

        if (shiftCrossesMidnight) {
          whereClause = `csh.created_at::date = $1::date 
                AND (csh.created_at::time >= $2::time OR csh.created_at::time <= $3::time)`;
        }

        const performanceResult = await dbPool.query(
          `SELECT 
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as avg_operating_rate,
                SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as total_running_minutes,
                COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.controller_id END) as total_alarm_count,
                COUNT(DISTINCT csh.controller_id) as total_controllers
              FROM controller_status_history csh
              WHERE ${whereClause}`,
          [today, shift.shift_start, shift.shift_end],
        );

        const perf = performanceResult.rows[0];

        const runningMinutes = parseFloat(perf.total_running_minutes) || 0;
        const hours = Math.floor(runningMinutes / 60);
        const minutes = Math.floor(runningMinutes % 60);
        const totalRunningTime = `${hours}h ${minutes}m`;

        const bestControllerResult = await dbPool.query(
          `SELECT 
                c.id,
                c.name,
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate
              FROM controller c
              INNER JOIN controller_status_history csh ON c.id = csh.controller_id
              WHERE ${whereClause}
              GROUP BY c.id, c.name
              HAVING COUNT(*) > 0
              ORDER BY operating_rate DESC
              LIMIT 1`,
          [today, shift.shift_start, shift.shift_end],
        );

        const bestController = bestControllerResult.rows[0];

        const allControllersResult = await dbPool.query(
          `SELECT 
                c.id,
                c.name,
                AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate,
                SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as running_minutes,
                COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.id END) as alarm_count
              FROM controller c
              LEFT JOIN controller_status_history csh ON c.id = csh.controller_id AND ${whereClause}
              GROUP BY c.id, c.name
              ORDER BY operating_rate DESC`,
          [today, shift.shift_start, shift.shift_end],
        );

        const controllerPerformances: ControllerPerformance[] = allControllersResult.rows.map((row) => {
          const runningMinutes = parseFloat(row.running_minutes) || 0;
          const hours = Math.floor(runningMinutes / 60);
          const minutes = Math.floor(runningMinutes % 60);
          return {
            id: row.id,
            name: row.name,
            operatingRate: parseFloat(row.operating_rate) || 0,
            runningTime: `${hours}h ${minutes}m`,
            alarmCount: parseInt(row.alarm_count) || 0,
          };
        });

        const summary: PerformanceSummary = {
          shiftName: shift.name,
          shiftStartTime: shift.shift_start,
          shiftEndTime: shift.shift_end,
          averageOperatingRate: parseFloat(perf.avg_operating_rate) || 0,
          totalRunningTime: totalRunningTime,
          totalAlarmCount: parseInt(perf.total_alarm_count) || 0,
          averageCycleTime: "N/A",
          bestPerformingController: bestController
            ? {
                id: bestController.id,
                name: bestController.name,
                operatingRate: parseFloat(bestController.operating_rate) || 0,
              }
            : undefined,
          controllerPerformances,
          period: "current_shift",
        };

        return res.status(200).json(summary);
      }
    }

    const performanceResult = await dbPool.query(
      `SELECT 
            AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as avg_operating_rate,
            SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as total_running_minutes,
            COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.controller_id END) as total_alarm_count
          FROM controller_status_history csh
          WHERE csh.created_at >= NOW() - INTERVAL '24 hours'`,
    );

    const perf = performanceResult.rows[0];

    const runningMinutes = parseFloat(perf.total_running_minutes) || 0;
    const hours = Math.floor(runningMinutes / 60);
    const minutes = Math.floor(runningMinutes % 60);
    const totalRunningTime = `${hours}h ${minutes}m`;

    const bestControllerResult = await dbPool.query(
      `SELECT 
            c.id,
            c.name,
            AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate
          FROM controller c
          INNER JOIN controller_status_history csh ON c.id = csh.controller_id
          WHERE csh.created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY c.id, c.name
          HAVING COUNT(*) > 0
          ORDER BY operating_rate DESC
          LIMIT 1`,
    );

    const bestController = bestControllerResult.rows[0];

    const allControllersResult = await dbPool.query(
      `SELECT 
            c.id,
            c.name,
            AVG(CASE WHEN csh.operating = true THEN 100 ELSE 0 END) as operating_rate,
            SUM(CASE WHEN csh.operating = true THEN 1 ELSE 0 END) * 5 / 60.0 as running_minutes,
            COUNT(DISTINCT CASE WHEN csh.alarm = true THEN csh.id END) as alarm_count
          FROM controller c
          LEFT JOIN controller_status_history csh ON c.id = csh.controller_id 
            AND csh.created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY c.id, c.name
          ORDER BY operating_rate DESC`,
    );

    const controllerPerformances: ControllerPerformance[] = allControllersResult.rows.map((row) => {
      const runningMinutes = parseFloat(row.running_minutes) || 0;
      const hours = Math.floor(runningMinutes / 60);
      const minutes = Math.floor(runningMinutes % 60);
      return {
        id: row.id,
        name: row.name,
        operatingRate: parseFloat(row.operating_rate) || 0,
        runningTime: `${hours}h ${minutes}m`,
        alarmCount: parseInt(row.alarm_count) || 0,
      };
    });

    const summary: PerformanceSummary = {
      averageOperatingRate: parseFloat(perf.avg_operating_rate) || 0,
      totalRunningTime: totalRunningTime,
      totalAlarmCount: parseInt(perf.total_alarm_count) || 0,
      averageCycleTime: "N/A",
      bestPerformingController: bestController
        ? {
            id: bestController.id,
            name: bestController.name,
            operatingRate: parseFloat(bestController.operating_rate) || 0,
          }
        : undefined,
      controllerPerformances,
      period: "last_24h",
    };

    return res.status(200).json(summary);
  } catch (error: any) {
    console.error("Performance summary error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export interface RecentAlarm {
  controllerId: string;
  controllerName: string;
  alarmCode: string;
  alarmName: string;
  alarmType: "MAJOR" | "MINOR" | "USER" | "SYSTEM" | "OFFLINE";
  date: string;
  ipAddress: string;
}

const getRecentAlarm = async (req: Request, res: Response) => {
  const { limit = 10, hours = 24 } = req.query;

  try {
    const result = await dbPool.query(
      `SELECT 
            c.id as controller_id,
            c.name as controller_name,
            c.ip_address,
            a.code,
            a.name as alarm_name,
            a.type as alarm_type,
            a.origin_date,
            a.mode
          FROM almhist a
          INNER JOIN controller c ON a.controller_id = c.id
          WHERE a.origin_date::timestamp >= NOW() - INTERVAL '1 hour' * $1
          ORDER BY a.origin_date DESC
          LIMIT $2`,
      [hours, limit],
    );

    const recentAlarms: RecentAlarm[] = result.rows.map((row) => ({
      controllerId: row.controller_id,
      controllerName: row.controller_name,
      alarmCode: row.code,
      alarmName: row.alarm_name || "Unknown Alarm",
      alarmType: row.alarm_type || "MAJOR",
      date: row.origin_date || new Date().toISOString(),
      ipAddress: row.ip_address,
    }));

    return res.status(200).json(recentAlarms);
  } catch (error: any) {
    console.error("Recent alarms error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export interface DashboardStats {
  totalControllers: number;
  activeControllers: number;
  controllersWithAlarm: number;
  maintenanceRequired: number;
  disconnectedControllers: number;
}

const getStats = async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(`
          SELECT 
            COUNT(DISTINCT c.id) as total_controllers,
            COUNT(DISTINCT CASE WHEN LOWER(c.status) = 'active' THEN c.id END) as active_controllers,
            COUNT(DISTINCT CASE WHEN cs.connection = false OR cs.connection IS NULL THEN c.id END) as disconnected_controllers
          FROM controller c
          LEFT JOIN controller_status cs ON c.id = cs.controller_id
        `);

    const alarmResult = await dbPool.query(`
          SELECT COUNT(*) as total_alarms
          FROM almhist
          WHERE origin_date::timestamp >= NOW() - INTERVAL '24 hours'
        `);

    let maintenanceCount = 0;
    try {
      const maintenanceResult = await dbPool.query(`
            SELECT COUNT(DISTINCT mp.controller_id) as maintenance_required
            FROM maintenance_plan mp
            WHERE mp.next_maintenance_time IS NOT NULL
              AND mp.next_maintenance_time != ''
              AND (
                TO_TIMESTAMP(mp.next_maintenance_time, 'DD.MM.YYYY HH24:MI:SS') <= CURRENT_TIMESTAMP + INTERVAL '7 days'
                OR TO_TIMESTAMP(mp.next_maintenance_time, 'DD.MM.YYYY HH24:MI:SS') < CURRENT_TIMESTAMP
              )
          `);
      maintenanceCount = parseInt(maintenanceResult.rows[0]?.maintenance_required) || 0;
    } catch (err) {
      try {
        const simpleCheck = await dbPool.query(`
              SELECT COUNT(DISTINCT controller_id) as maintenance_required
              FROM maintenance_plan
              WHERE next_maintenance_time IS NOT NULL
            `);
        maintenanceCount = parseInt(simpleCheck.rows[0]?.maintenance_required) || 0;
      } catch (err2) {
        console.log("Maintenance table check skipped");
        maintenanceCount = 0;
      }
    }

    const stats = result.rows[0];
    const alarmStats = alarmResult.rows[0];

    const dashboardStats: DashboardStats = {
      totalControllers: parseInt(stats.total_controllers) || 0,
      activeControllers: parseInt(stats.active_controllers) || 0,
      controllersWithAlarm: parseInt(alarmStats.total_alarms) || 0,
      maintenanceRequired: maintenanceCount,
      disconnectedControllers: parseInt(stats.disconnected_controllers) || 0,
    };

    return res.status(200).json(dashboardStats);
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export interface LineHierarchy {
  id: string;
  name: string;
  status: string;
  factoryName: string;
  cells: CellWithControllers[];
}

export interface CellWithControllers {
  id: string;
  name: string;
  status: string;
  lineId: string;
  controllers: ControllerDetail[];
}

export interface ControllerDetail {
  id: string;
  name: string;
  model?: string;
  application?: string;
  ipAddress: string;
  status: string;
  location?: string;
  cellId?: string;
}

const getDashboardHierarchy = async (req: Request, res: Response) => {
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
      // Skip null/undefined rows
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

export { getAlarmStats, getDebug, getPerformance, getRecentAlarm, getStats, getDashboardHierarchy };
