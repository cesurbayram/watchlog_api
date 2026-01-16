import { dbPool } from "../../config/db.js";
import { readLogDataFile, analyzeLogEntries } from "../logdata-parser.js";
import { parseSystemFile } from "../parse-system-file.js";
import fs from "fs";
import path from "path";
import os from "os";

export interface ControllerStatusData {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  location: string;
  application: string;
  version?: string;
  language?: string;
  param_no?: string;
  manipulator_type?: string;
  factory?: string;
  line?: string;
  cell?: string;
  serial_number?: string;
  status: string;
  isOnline: boolean;
  servo: boolean;
  operating: boolean;
  teach: string;
  alarm: boolean;
  error: boolean;
  hold: boolean;
  doorOpen: boolean;
  connection: boolean;
  lastUpdate: string;
  shiftStatusData?: any[];
  servoHours?: number;
}

export interface PerformanceAnalysis {
  currentPeriod: {
    avgServoTime: number;
    avgControlPowerTime: number;
    avgPlaybackTime: number;
    avgMovingTime: number;
    avgOperatingTime: number;
    totalRecords: number;
  };
  previousPeriod: {
    avgServoTime: number;
    avgControlPowerTime: number;
    avgPlaybackTime: number;
    avgMovingTime: number;
    avgOperatingTime: number;
    totalRecords: number;
  };
  comparison: {
    servoTimeDiff: number;
    servoTimeDiffPercent: number;
    operatingTimeDiff: number;
    operatingTimeDiffPercent: number;
  };
  weeklyTrend: { date: string; avgServoTime: number; avgOperatingTime: number }[];
  robotPerformances: {
    controllerName: string;
    servoTime: number;
    efficiency: number;
    operatingTime: number;
  }[];
}

export interface AlarmAnalysis {
  totalLast24h: number;
  activeAlarms: number;
  topAlarmCodes: { code: string; text: string; count: number; severity: string }[];
  severityDistribution: { major: number; minor: number };
  recentAlarms: {
    controllerName: string;
    code: string;
    text: string;
    detected: string;
    removed: string | null;
    severity: string;
  }[];
  alarmsByController: { controllerName: string; alarmCount: number }[];
  last3AlarmsByRobot?: any[];
}

export interface BackupStatus {
  controllersWithBackup: number;
  controllersWithoutBackup: number;
  totalBackupSessions: number;
  successRate: number;
  backupDetails: any[];
  missingBackups: string[];
}

export interface ProductionSummary {
  totalProductionToday: number;
  totalProductionYesterday: number;
  productionDiff: number;
  productionDiffPercent: number;
  topJob: string | null;
  topJobCount: number;
  shiftProduction: any[];
  productionByController: any[];
}

export interface MaintenanceData {
  recentMaintenance: any[];
  upcomingMaintenance: any[];
  totalMaintenanceRecords: number;
  controllersNeedingMaintenance: number;
}

export interface LogAnalysis {
  totalLogEntries: number;
  logsByController: any[];
  topEvents: { eventType: string; count: number; percentage: number }[];
  criticalEvents: any[];
  eventTypeDistribution: Record<string, number>;
  last3LogsByRobot?: any[];
}

export interface SystemSummary {
  totalRobots: number;
  onlineCount: number;
  offlineCount: number;
  avgServoTime: number;
  totalAlarmsLast24h: number;
  topPerformingRobot: string;
  mostAlarmsRobot: string;
}

export interface SystemHealthReportData {
  metadata: {
    reportId: string;
    generatedAt: string;
    dateRange: { from: string; to: string };
    totalControllers: number;
    shifts?: { name: string; start: string; end: string }[];
  };
  summary: SystemSummary;
  controllers: ControllerStatusData[];
  performance: PerformanceAnalysis;
  alarms: AlarmAnalysis;
  backups: BackupStatus;
  production: ProductionSummary;
  maintenance: MaintenanceData;
  logs: LogAnalysis;
}

export async function collectSystemHealthData(
  controllerIds?: string[],
  timeRange: "24h" | "7d" | "shift" = "7d",
  shiftId?: string,
): Promise<SystemHealthReportData> {
  const now = new Date();

  let startDate = new Date(now);
  if (timeRange === "24h") {
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeRange === "7d") {
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeRange === "shift" && shiftId) {
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(startDate.getDate() - 7);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const daysToFetch = timeRange === "24h" ? 1 : timeRange === "shift" ? 1 : 7;

  const [controllers, performance, alarms, backups, logs, shifts] = await Promise.all([
    collectControllerStatusWithShifts(controllerIds, daysToFetch),
    collectPerformanceData(controllerIds),
    collectAlarmData(controllerIds),
    collectBackupStatus(controllerIds),
    collectLogData(controllerIds),
    collectShiftData(),
  ]);

  const summary = generateSystemSummary(controllers, alarms, performance);

  const production: ProductionSummary = {
    totalProductionToday: 0,
    totalProductionYesterday: 0,
    productionDiff: 0,
    productionDiffPercent: 0,
    topJob: null,
    topJobCount: 0,
    shiftProduction: [],
    productionByController: [],
  };

  const maintenance: MaintenanceData = {
    recentMaintenance: [],
    upcomingMaintenance: [],
    totalMaintenanceRecords: 0,
    controllersNeedingMaintenance: 0,
  };

  return {
    metadata: {
      reportId: crypto.randomUUID(),
      generatedAt: now.toISOString(),
      dateRange: {
        from: yesterday.toISOString(),
        to: now.toISOString(),
      },
      totalControllers: controllers.length,
      shifts: shifts,
    },
    summary,
    controllers,
    performance,
    alarms,
    backups,
    production,
    maintenance,
    logs,
  };
}

function generateSystemSummary(controllers: ControllerStatusData[], alarms: AlarmAnalysis, performance: PerformanceAnalysis): SystemSummary {
  const onlineControllers = controllers.filter((c) => c.isOnline);
  const offlineControllers = controllers.filter((c) => !c.isOnline);

  const topRobot = performance.robotPerformances.length > 0 ? performance.robotPerformances[0].controllerName : "N/A";

  const mostAlarmsRobot = alarms.alarmsByController.length > 0 ? alarms.alarmsByController[0].controllerName : "N/A";

  return {
    totalRobots: controllers.length,
    onlineCount: onlineControllers.length,
    offlineCount: offlineControllers.length,
    avgServoTime: performance.currentPeriod.avgServoTime,
    totalAlarmsLast24h: alarms.totalLast24h,
    topPerformingRobot: topRobot,
    mostAlarmsRobot: mostAlarmsRobot,
  };
}

async function collectControllerStatusWithShifts(controllerIds?: string[], daysToFetch: number = 7): Promise<ControllerStatusData[]> {
  try {
    const query =
      controllerIds && controllerIds.length > 0
        ? `
        SELECT 
          c.id,
          c.name,
          c.model,
          c.ip_address,
          c.location,
          c.application,
          c.serial_number,
          c.status,
          COALESCE(cs.servo, false) as servo,
          COALESCE(cs.operating, false) as operating,
          COALESCE(cs.teach, 'PLAY') as teach,
          COALESCE(cs.alarm, false) as alarm,
          COALESCE(cs.error, false) as error,
          COALESCE(cs.hold, false) as hold,
          COALESCE(cs.stop, false) as door_open,
          true as connection,
          cs.update_at as updated_at
        FROM controller c
        LEFT JOIN controller_status cs ON c.id = cs.controller_id
        WHERE c.id = ANY($1)
        ORDER BY c.name
      `
        : `
        SELECT 
          c.id,
          c.name,
          c.model,
          c.ip_address,
          c.location,
          c.application,
          c.serial_number,
          c.status,
          COALESCE(cs.servo, false) as servo,
          COALESCE(cs.operating, false) as operating,
          COALESCE(cs.teach, 'PLAY') as teach,
          COALESCE(cs.alarm, false) as alarm,
          COALESCE(cs.error, false) as error,
          COALESCE(cs.hold, false) as hold,
          COALESCE(cs.stop, false) as door_open,
          true as connection,
          cs.update_at as updated_at
        FROM controller c
        LEFT JOIN controller_status cs ON c.id = cs.controller_id
        ORDER BY c.name
      `;

    const result = controllerIds && controllerIds.length > 0 ? await dbPool.query(query, [controllerIds]) : await dbPool.query(query);

    if (result.rows.length === 0) {
      return [];
    }

    const controllers = await Promise.all(
      result.rows.map(async (row: any) => {
        const servoQuery = await dbPool.query(
          `
          SELECT servo_power_time
          FROM utilization_data
          WHERE controller_id = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `,
          [row.id],
        );

        const servoHours = servoQuery.rows.length > 0 ? Number(servoQuery.rows[0].servo_power_time) || 0 : 0;

        let lineName = "N/A";
        let cellName = "N/A";
        let factoryName = "N/A";

        if (row.location) {
          const locationParts = row.location.split("/");
          if (locationParts.length >= 3) {
            factoryName = locationParts[0] || "N/A";
            lineName = locationParts[1] || "N/A";
            cellName = locationParts[2] || "N/A";
          }
        }

        const systemInfo = await readSystemInfo(row.ip_address);

        return {
          id: row.id,
          name: row.name,
          model: row.model || systemInfo.robotModel || "Unknown",
          ipAddress: row.ip_address,
          location: row.location || "Unknown",
          application: row.application || systemInfo.application || "Unknown",
          version: systemInfo.version || "N/A",
          language: systemInfo.language || "N/A",
          param_no: systemInfo.paramNo || "N/A",
          manipulator_type: systemInfo.manipulatorType || "N/A",
          factory: factoryName,
          line: lineName,
          cell: cellName,
          serial_number: row.serial_number || "N/A",
          status: row.status || "Unknown",
          isOnline: row.connection === true,
          servo: row.servo === true,
          operating: row.operating === true,
          teach: row.teach || "Unknown",
          alarm: row.alarm === true,
          error: row.error === true,
          hold: row.hold === true,
          doorOpen: row.door_open === true,
          connection: row.connection === true,
          lastUpdate: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          servoHours,
        };
      }),
    );

    return controllers;
  } catch (error) {
    console.error("[System Health] Error collecting controller status with shifts:", error);
    return [];
  }
}

async function collectPerformanceData(controllerIds?: string[]): Promise<PerformanceAnalysis> {
  try {
    const tableCheck = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'utilization_data'
      );
    `);

    if (!tableCheck.rows[0]?.exists) {
      return getEmptyPerformanceData();
    }

    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const currentPeriodQuery = `
      SELECT 
        controller_id,
        MAX(servo_power_time) as servo_time,
        MAX(control_power_time) as control_power_time,
        MAX(playback_time) as playback_time,
        MAX(moving_time) as moving_time,
        MAX(operating_time) as operating_time
      FROM utilization_data
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY controller_id
    `;

    const previousPeriodQuery = `
      SELECT 
        controller_id,
        MAX(servo_power_time) as servo_time,
        MAX(control_power_time) as control_power_time,
        MAX(playback_time) as playback_time,
        MAX(moving_time) as moving_time,
        MAX(operating_time) as operating_time
      FROM utilization_data
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY controller_id
    `;

    const currentValues = await dbPool.query(currentPeriodQuery, [oneDayAgo, now]);
    const previousValues = await dbPool.query(previousPeriodQuery, [twoDaysAgo, oneDayAgo]);

    let totalServo = 0,
      totalControl = 0,
      totalPlayback = 0,
      totalMoving = 0,
      totalOperating = 0;
    let prevTotalServo = 0,
      prevTotalControl = 0,
      prevTotalPlayback = 0,
      prevTotalMoving = 0,
      prevTotalOperating = 0;

    currentValues.rows.forEach((row: any) => {
      totalServo += parseFloat(row.servo_time || "0");
      totalControl += parseFloat(row.control_power_time || "0");
      totalPlayback += parseFloat(row.playback_time || "0");
      totalMoving += parseFloat(row.moving_time || "0");
      totalOperating += parseFloat(row.operating_time || "0");
    });

    previousValues.rows.forEach((row: any) => {
      prevTotalServo += parseFloat(row.servo_time || "0");
      prevTotalControl += parseFloat(row.control_power_time || "0");
      prevTotalPlayback += parseFloat(row.playback_time || "0");
      prevTotalMoving += parseFloat(row.moving_time || "0");
      prevTotalOperating += parseFloat(row.operating_time || "0");
    });

    const currentPeriod = {
      avgServoTime: totalServo - prevTotalServo,
      avgControlPowerTime: totalControl - prevTotalControl,
      avgPlaybackTime: totalPlayback - prevTotalPlayback,
      avgMovingTime: totalMoving - prevTotalMoving,
      avgOperatingTime: totalOperating - prevTotalOperating,
      totalRecords: currentValues.rows.length,
    };

    const previousPeriod = {
      avgServoTime: prevTotalServo,
      avgControlPowerTime: prevTotalControl,
      avgPlaybackTime: prevTotalPlayback,
      avgMovingTime: prevTotalMoving,
      avgOperatingTime: prevTotalOperating,
      totalRecords: previousValues.rows.length,
    };

    const servoTimeDiff = currentPeriod.avgServoTime - previousPeriod.avgServoTime;
    const servoTimeDiffPercent = previousPeriod.avgServoTime > 0 ? (servoTimeDiff / previousPeriod.avgServoTime) * 100 : 0;

    const operatingTimeDiff = currentPeriod.avgOperatingTime - previousPeriod.avgOperatingTime;
    const operatingTimeDiffPercent = previousPeriod.avgOperatingTime > 0 ? (operatingTimeDiff / previousPeriod.avgOperatingTime) * 100 : 0;

    const robotQuery = `
      WITH today_max AS (
        SELECT 
          controller_id,
          MAX(servo_power_time) as servo_time,
          MAX(operating_time) as operating_time,
          MAX(control_power_time) as control_power_time
        FROM utilization_data
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY controller_id
      ),
      yesterday_max AS (
        SELECT 
          controller_id,
          MAX(servo_power_time) as servo_time,
          MAX(operating_time) as operating_time,
          MAX(control_power_time) as control_power_time
        FROM utilization_data
        WHERE timestamp >= $3 AND timestamp <= $1
        GROUP BY controller_id
      )
      SELECT 
        c.name as controller_name,
        COALESCE(tm.servo_time, 0) - COALESCE(ym.servo_time, 0) as servo_time,
        COALESCE(tm.operating_time, 0) - COALESCE(ym.operating_time, 0) as operating_time,
        ((COALESCE(tm.operating_time, 0) - COALESCE(ym.operating_time, 0)) / 
         NULLIF((COALESCE(tm.control_power_time, 0) - COALESCE(ym.control_power_time, 0)), 0)) * 100 as efficiency
      FROM controller c
      LEFT JOIN today_max tm ON c.id = tm.controller_id
      LEFT JOIN yesterday_max ym ON c.id = ym.controller_id
      WHERE tm.controller_id IS NOT NULL OR ym.controller_id IS NOT NULL
      ORDER BY servo_time DESC
    `;

    const robotResult = await dbPool.query(robotQuery, [oneDayAgo, now, twoDaysAgo]);

    return {
      currentPeriod,
      previousPeriod,
      comparison: {
        servoTimeDiff,
        servoTimeDiffPercent,
        operatingTimeDiff,
        operatingTimeDiffPercent,
      },
      weeklyTrend: [],
      robotPerformances: robotResult.rows.map((row: any) => ({
        controllerName: row.controller_name || "Unknown",
        servoTime: Number(row.servo_time) || 0,
        efficiency: Number(row.efficiency) || 0,
        operatingTime: Number(row.operating_time) || 0,
      })),
    };
  } catch (error) {
    return getEmptyPerformanceData();
  }
}

function getEmptyPerformanceData(): PerformanceAnalysis {
  return {
    currentPeriod: {
      avgServoTime: 0,
      avgControlPowerTime: 0,
      avgPlaybackTime: 0,
      avgMovingTime: 0,
      avgOperatingTime: 0,
      totalRecords: 0,
    },
    previousPeriod: {
      avgServoTime: 0,
      avgControlPowerTime: 0,
      avgPlaybackTime: 0,
      avgMovingTime: 0,
      avgOperatingTime: 0,
      totalRecords: 0,
    },
    comparison: {
      servoTimeDiff: 0,
      servoTimeDiffPercent: 0,
      operatingTimeDiff: 0,
      operatingTimeDiffPercent: 0,
    },
    weeklyTrend: [],
    robotPerformances: [],
  };
}

async function collectAlarmData(controllerIds?: string[]): Promise<AlarmAnalysis> {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const totalQuery = `
      SELECT COUNT(*) as count
      FROM alarm
      WHERE detected >= $1
    `;

    const totalResult = await dbPool.query(totalQuery, [oneDayAgo]);
    const totalLast24h = parseInt(totalResult.rows[0]?.count || "0");

    const activeQuery = `
      SELECT COUNT(*) as count
      FROM alarm
      WHERE removed IS NULL
    `;

    const activeResult = await dbPool.query(activeQuery);
    const activeAlarms = parseInt(activeResult.rows[0]?.count || "0");

    const topCodesQuery = `
      SELECT 
        code,
        text,
        priority as type,
        COUNT(*) as count
      FROM alarm
      WHERE detected >= $1
      GROUP BY code, text, priority
      ORDER BY count DESC
    `;

    const topCodesResult = await dbPool.query(topCodesQuery, [oneDayAgo]);

    const severityQuery = `
      SELECT 
        priority as type,
        COUNT(*) as count
      FROM alarm
      WHERE detected >= $1
      GROUP BY priority
    `;

    const severityResult = await dbPool.query(severityQuery, [oneDayAgo]);

    let majorCount = 0;
    let minorCount = 0;
    severityResult.rows.forEach((row: any) => {
      if (row.type && row.type.toUpperCase().includes("MAJOR")) majorCount = parseInt(row.count);
      if (row.type && row.type.toUpperCase().includes("MINOR")) minorCount = parseInt(row.count);
    });

    const recentQuery = `
      SELECT 
        c.name as controller_name,
        a.code,
        a.text,
        a.detected,
        a.removed,
        a.priority as type
      FROM alarm a
      LEFT JOIN controller c ON a.controller_id = c.id
      WHERE a.detected >= $1
      ORDER BY a.detected DESC
    `;

    const recentResult = await dbPool.query(recentQuery, [oneDayAgo]);

    const byControllerQuery = `
      SELECT 
        c.name as controller_name,
        COUNT(a.id) as alarm_count
      FROM alarm a
      LEFT JOIN controller c ON a.controller_id = c.id
      WHERE a.detected >= $1
      GROUP BY c.name
      ORDER BY alarm_count DESC
    `;

    const byControllerResult = await dbPool.query(byControllerQuery, [oneDayAgo]);

    return {
      totalLast24h,
      activeAlarms,
      topAlarmCodes: topCodesResult.rows.map((row: any) => ({
        code: row.code || "Unknown",
        text: row.text || "No description",
        count: parseInt(row.count),
        severity: row.type || "Unknown",
      })),
      severityDistribution: {
        major: majorCount,
        minor: minorCount,
      },
      recentAlarms: recentResult.rows.map((row: any) => ({
        controllerName: row.controller_name || "Unknown",
        code: row.code || "Unknown",
        text: row.text || "No description",
        detected: row.detected ? new Date(row.detected).toISOString() : "Unknown",
        removed: row.removed ? new Date(row.removed).toISOString() : null,
        severity: row.type || "Unknown",
      })),
      alarmsByController: byControllerResult.rows.map((row: any) => ({
        controllerName: row.controller_name || "Unknown",
        alarmCount: parseInt(row.alarm_count),
      })),
    };
  } catch (error) {
    return {
      totalLast24h: 0,
      activeAlarms: 0,
      topAlarmCodes: [],
      severityDistribution: { major: 0, minor: 0 },
      recentAlarms: [],
      alarmsByController: [],
    };
  }
}

async function collectBackupStatus(controllerIds?: string[]): Promise<BackupStatus> {
  try {
    const query = `
      SELECT 
        c.id as controller_id,
        c.name as controller_name,
        bp.created_at as last_backup_date,
        bp.is_active as status
      FROM controller c
      LEFT JOIN backup_plans bp ON c.id = bp.controller_id
      ORDER BY c.name
    `;

    const result = await dbPool.query(query);

    const now = new Date();
    const backupDetails = result.rows.map((row: any) => {
      const lastBackupDate = row.last_backup_date ? new Date(row.last_backup_date) : null;
      const daysSinceLastBackup = lastBackupDate ? Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        controllerName: row.controller_name,
        lastBackupDate: lastBackupDate ? lastBackupDate.toISOString() : null,
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        status: row.status ? "active" : "inactive",
        daysSinceLastBackup,
      };
    });

    const controllersWithBackup = backupDetails.filter((d: any) => d.lastBackupDate).length;
    const controllersWithoutBackup = backupDetails.filter((d: any) => !d.lastBackupDate).length;
    const totalSuccessful = backupDetails.reduce((sum: number, d: any) => sum + d.successfulFiles, 0);
    const totalFiles = backupDetails.reduce((sum: number, d: any) => sum + d.totalFiles, 0);
    const successRate = totalFiles > 0 ? (totalSuccessful / totalFiles) * 100 : 0;

    const missingBackups = backupDetails
      .filter((d: any) => !d.lastBackupDate || (d.daysSinceLastBackup && d.daysSinceLastBackup > 7))
      .map((d: any) => d.controllerName);

    return {
      controllersWithBackup,
      controllersWithoutBackup,
      totalBackupSessions: backupDetails.length,
      successRate,
      backupDetails,
      missingBackups,
    };
  } catch (error) {
    return {
      controllersWithBackup: 0,
      controllersWithoutBackup: 0,
      totalBackupSessions: 0,
      successRate: 0,
      backupDetails: [],
      missingBackups: [],
    };
  }
}

async function collectLogData(controllerIds?: string[]): Promise<LogAnalysis> {
  try {
    const controllersQuery = `
      SELECT id, name, ip_address
      FROM controller
      ORDER BY name
    `;

    const controllersResult = await dbPool.query(controllersQuery);

    const logsByController = [];
    const last3LogsByRobot = [];
    const allTopEvents: Record<string, number> = {};
    const allCriticalEvents: any[] = [];
    let totalLogEntries = 0;

    for (const controller of controllersResult.rows) {
      try {
        const logEntries = await readLogDataFile(controller.ip_address);
        const analysis = analyzeLogEntries(logEntries);

        totalLogEntries += analysis.totalEntries;

        Object.entries(analysis.eventCounts).forEach(([event, count]) => {
          allTopEvents[event] = (allTopEvents[event] || 0) + count;
        });

        analysis.criticalEvents.forEach((event: any) => {
          allCriticalEvents.push({
            controllerName: controller.name,
            event: event.event || "Unknown",
            date: event.date || "Unknown",
            loginName: event.loginName || "Unknown",
          });
        });

        const lastLogEntry = logEntries[0];

        logsByController.push({
          controllerName: controller.name,
          totalEntries: analysis.totalEntries,
          lastLogDate: lastLogEntry?.date || null,
          criticalCount: analysis.criticalEvents.length,
        });

        const servoQuery = await dbPool.query(
          `
          SELECT servo_power_time
          FROM utilization_data
          WHERE controller_id = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `,
          [controller.id],
        );

        const servoHours = servoQuery.rows.length > 0 ? Number(servoQuery.rows[0].servo_power_time) || 0 : 0;

        const last3 = logEntries.slice(0, 3).map((log: any) => ({
          index: log.index || 0,
          date: log.date || "N/A",
          event: log.event || "N/A",
        }));

        last3LogsByRobot.push({
          controllerName: controller.name,
          servoHours,
          last3Logs: last3,
        });
      } catch (error) {
        logsByController.push({
          controllerName: controller.name,
          totalEntries: 0,
          lastLogDate: null,
          criticalCount: 0,
        });

        const servoQuery = await dbPool.query(
          `
          SELECT servo_power_time
          FROM utilization_data
          WHERE controller_id = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `,
          [controller.id],
        );

        const servoHours = servoQuery.rows.length > 0 ? Number(servoQuery.rows[0].servo_power_time) || 0 : 0;

        last3LogsByRobot.push({
          controllerName: controller.name,
          servoHours,
          last3Logs: [],
        });
      }
    }

    const topEvents = Object.entries(allTopEvents)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventType, count]) => ({
        eventType,
        count,
        percentage: totalLogEntries > 0 ? (count / totalLogEntries) * 100 : 0,
      }));

    const criticalEvents = allCriticalEvents.slice(0, 20);

    return {
      totalLogEntries,
      logsByController,
      topEvents,
      criticalEvents,
      eventTypeDistribution: allTopEvents,
      last3LogsByRobot,
    };
  } catch (error) {
    return {
      totalLogEntries: 0,
      logsByController: [],
      topEvents: [],
      criticalEvents: [],
      eventTypeDistribution: {},
    };
  }
}

async function collectShiftData(): Promise<{ name: string; start: string; end: string }[]> {
  try {
    const shiftsQuery = await dbPool.query(`
      SELECT id, name, shift_start, shift_end
      FROM shift
      ORDER BY shift_start
    `);

    return shiftsQuery.rows.map((shift: any) => ({
      name: shift.name,
      start: shift.shift_start,
      end: shift.shift_end,
    }));
  } catch (error) {
    console.error("Error collecting shift data:", error);
    return [];
  }
}

async function readSystemInfo(ipAddress: string): Promise<{
  version?: string;
  systemNo?: string;
  robotModel?: string;
  application?: string;
  language?: string;
  paramNo?: string;
  manipulatorType?: string;
}> {
  try {
    const folderName = `${ipAddress}_SYSTEM`;

    const baseDir =
      process.env.WATCHLOG_BASE_DIR || (process.platform === "win32" ? path.join("C:", "Watchlog", "UI") : path.join(os.homedir(), "Watchlog", "UI"));

    const systemInfoDir = path.join(baseDir, folderName);

    if (!fs.existsSync(systemInfoDir)) {
      return {};
    }

    const files = fs.readdirSync(systemInfoDir);
    const systemFiles = files.filter((file) => file.toUpperCase().includes("SYSTEM") && (file.endsWith(".SYS") || file.endsWith(".sys")));

    if (systemFiles.length === 0) {
      return {};
    }

    const latestFile = systemFiles
      .map((fileName) => {
        const filePath = path.join(systemInfoDir, fileName);
        const stats = fs.statSync(filePath);
        return { fileName, filePath, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

    const content = fs.readFileSync(latestFile.filePath, "utf8");
    const parsedInfo = parseSystemFile(content);

    const manipulatorType = parsedInfo.robots.length > 0 ? `${parsedInfo.robots[0].name} - ${parsedInfo.robots[0].model}` : undefined;

    let languageCode = "N/A";
    if (parsedInfo.systemNo) {
      const langMatch = parsedInfo.systemNo.match(/\(([A-Z\/]+)\)/);
      if (langMatch) {
        languageCode = langMatch[1];
      }
    }

    return {
      version: parsedInfo.version,
      systemNo: parsedInfo.systemNo,
      robotModel: parsedInfo.robotModel,
      application: parsedInfo.application,
      language: languageCode,
      paramNo: parsedInfo.paramNo,
      manipulatorType: manipulatorType,
    };
  } catch (error) {
    console.error(`Error reading system info for ${ipAddress}:`, error);
    return {};
  }
}
