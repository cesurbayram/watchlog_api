import { dbPool } from "../../config/db.js";
import { parseSystemFile } from "../parse-system-file.js";
import fs from "fs";
import path from "path";
import os from "os";
import { UtilizationReportData, ControllerUtilizationData, DailyUtilizationData } from "../../models/util-report-dto";

export async function collectUtilizationReportData(
  controllerIds?: string[],
  timeRange: "24h" | "7d" | "shift" = "7d",
  shiftId?: string,
): Promise<UtilizationReportData> {
  const client = await dbPool.connect();

  try {
    let daysToFetch = 7;
    if (timeRange === "24h") {
      daysToFetch = 1;
    } else if (timeRange === "shift") {
      daysToFetch = 1;
    }

    const controllersQuery =
      controllerIds && controllerIds.length > 0
        ? `
        SELECT 
          c.id, 
          c.name, 
          c.ip_address,
          c.model,
          c.application,
          c.serial_number,
          c.location,
          c.status
        FROM controller c
        LEFT JOIN controller_status ct ON c.id = ct.controller_id
        WHERE c.id = ANY($1)
        ORDER BY c.ip_address
      `
        : `
        SELECT 
          c.id, 
          c.name, 
          c.ip_address,
          c.model,
          c.application,
          c.serial_number,
          c.location,
          c.status
        FROM controller c
        LEFT JOIN controller_status ct ON c.id = ct.controller_id
        ORDER BY c.ip_address
      `;

    const controllersResult =
      controllerIds && controllerIds.length > 0 ? await client.query(controllersQuery, [controllerIds]) : await client.query(controllersQuery);
    const controllers = controllersResult.rows;

    const shiftsQuery = await client.query(`
      SELECT id, name, shift_start, shift_end
      FROM shift
      ORDER BY shift_start
    `);
    const shifts = shiftsQuery.rows;

    if (controllers.length === 0) {
      throw new Error("No controllers found");
    }

    const controllerData: ControllerUtilizationData[] = [];

    for (const controller of controllers) {
      const dailyData = await collectControllerDailyData(client, controller.id, daysToFetch);

      if (dailyData.length > 0) {
        const totals = calculateControllerTotals(dailyData);

        let lineName = "N/A";
        let cellName = "N/A";
        let factoryName = "N/A";

        if (controller.location) {
          const locationParts = controller.location.split("/");
          if (locationParts.length >= 3) {
            factoryName = locationParts[0] || "N/A";
            lineName = locationParts[1] || "N/A";
            cellName = locationParts[2] || "N/A";
          }
        }

        const systemInfo = await readSystemInfo(controller.ip_address);

        controllerData.push({
          id: controller.id,
          name: controller.name,
          ip_address: controller.ip_address,
          model: controller.model || systemInfo.robotModel || "N/A",
          application: controller.application || systemInfo.application || "N/A",
          version: systemInfo.version || "N/A",
          language: systemInfo.language || "N/A",
          param_no: systemInfo.paramNo || "N/A",
          manipulator_type: systemInfo.manipulatorType || "N/A",
          factory: factoryName,
          line: lineName,
          cell: cellName,
          daily_data: dailyData,
          totals,
        });
      }
    }

    const summary = calculateSummaryStatistics(controllerData);

    const periodText = timeRange === "24h" ? "Last 24 Hours" : timeRange === "shift" ? "By Shift" : "Last 7 Days";

    return {
      metadata: {
        title: `${periodText} Robot Utilization Report`,
        generated_at: new Date().toISOString(),
        period: periodText,
        total_controllers: controllers.length,
        shifts: shifts.map((shift: any) => ({
          name: shift.name,
          start: shift.shift_start,
          end: shift.shift_end,
        })),
      },
      controllers: controllerData,
      summary,
    };
  } catch (error) {
    try {
      const fallbackQuery = `
        SELECT 
          c.id, 
          c.name, 
          c.ip_address 
        FROM controller c
        ORDER BY c.name
      `;

      const fallbackResult = await client.query(fallbackQuery);

      return {
        metadata: {
          title: "7-Day Robot Utilization Report",
          generated_at: new Date().toISOString(),
          period: "Last 7 Days",
          total_controllers: fallbackResult.rows.length || 0,
        },
        controllers: [],
        summary: {
          total_operating_hours: 0,
          average_daily_hours: 0,
          most_efficient_controller: "N/A - No Data Available",
          least_efficient_controller: "N/A - No Data Available",
          total_efficiency_percentage: 0,
        },
      };
    } catch (fallbackError) {
      return {
        metadata: {
          title: "7-Day Robot Utilization Report",
          generated_at: new Date().toISOString(),
          period: "Last 7 Days",
          total_controllers: 0,
          shifts: [],
        },
        controllers: [],
        summary: {
          total_operating_hours: 0,
          average_daily_hours: 0,
          most_efficient_controller: "N/A - No Data Available",
          least_efficient_controller: "N/A - No Data Available",
          total_efficiency_percentage: 0,
        },
      };
    }
  } finally {
    client.release();
  }
}

async function collectControllerDailyData(client: any, controllerId: string, days: number = 7): Promise<DailyUtilizationData[]> {
  try {
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'utilization_data'
      );
    `;

    const tableExists = await client.query(tableCheckQuery);

    if (!tableExists.rows[0]?.exists) {
      return [];
    }

    const query = `
      WITH daily_latest AS (
        SELECT DISTINCT ON (DATE(timestamp))
          timestamp,
          control_power_time,
          servo_power_time,
          playback_time,
          moving_time,
          operating_time,
          DATE(timestamp) as record_date
        FROM utilization_data 
        WHERE controller_id = $1 
          AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY DATE(timestamp), timestamp DESC
      )
      SELECT 
        timestamp,
        control_power_time,
        servo_power_time,
        playback_time,
        moving_time,
        operating_time
      FROM daily_latest
      ORDER BY timestamp ASC
    `;

    const result = await client.query(query, [controllerId]);
    const dailyData: DailyUtilizationData[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];

      const operatingHours = parseFloat(row.operating_time || "0");
      const servoHours = parseFloat(row.servo_power_time || "0");
      const playbackHours = parseFloat(row.playback_time || "0");
      const movingHours = parseFloat(row.moving_time || "0");
      const controlHours = parseFloat(row.control_power_time || "0");

      const efficiencyPercentage = controlHours > 0 ? (operatingHours / controlHours) * 100 : 0;

      let dayOverDayChange = 0;
      let dayOverDayPercentage = 0;

      if (i > 0) {
        const prevOperating = parseFloat(result.rows[i - 1].operating_time || "0");
        dayOverDayChange = operatingHours - prevOperating;
        dayOverDayPercentage = prevOperating > 0 ? ((operatingHours - prevOperating) / prevOperating) * 100 : 0;
      }

      dailyData.push({
        date: new Date(row.timestamp).toISOString().split("T")[0],
        operating_hours: operatingHours,
        servo_power_hours: servoHours,
        playback_hours: playbackHours,
        moving_hours: movingHours,
        efficiency_percentage: Math.round(efficiencyPercentage * 100) / 100,
        day_over_day_change: Math.round(dayOverDayChange * 100) / 100,
        day_over_day_percentage: Math.round(dayOverDayPercentage * 100) / 100,
      });
    }

    return dailyData;
  } catch (error) {
    return [];
  }
}

function calculateControllerTotals(dailyData: DailyUtilizationData[]) {
  if (dailyData.length === 0) {
    return {
      total_operating_hours: 0,
      average_daily_hours: 0,
      efficiency_trend: 0,
      best_day: {} as DailyUtilizationData,
      worst_day: {} as DailyUtilizationData,
    };
  }

  const totalHours = dailyData.reduce((sum, day) => sum + day.operating_hours, 0);
  const averageHours = totalHours / dailyData.length;

  const firstDay = dailyData[0];
  const lastDay = dailyData[dailyData.length - 1];
  const efficiencyTrend = firstDay.operating_hours > 0 ? ((lastDay.operating_hours - firstDay.operating_hours) / firstDay.operating_hours) * 100 : 0;

  const bestDay = dailyData.reduce((best, day) => (day.operating_hours > best.operating_hours ? day : best));

  const worstDay = dailyData.reduce((worst, day) => (day.operating_hours < worst.operating_hours ? day : worst));

  return {
    total_operating_hours: Math.round(totalHours * 100) / 100,
    average_daily_hours: Math.round(averageHours * 100) / 100,
    efficiency_trend: Math.round(efficiencyTrend * 100) / 100,
    best_day: bestDay,
    worst_day: worstDay,
  };
}

function calculateSummaryStatistics(controllerData: ControllerUtilizationData[]) {
  if (controllerData.length === 0) {
    return {
      total_operating_hours: 0,
      average_daily_hours: 0,
      most_efficient_controller: "N/A",
      least_efficient_controller: "N/A",
      total_efficiency_percentage: 0,
    };
  }

  const totalOperatingHours = controllerData.reduce((sum, controller) => sum + controller.totals.total_operating_hours, 0);

  const averageDailyHours = controllerData.reduce((sum, controller) => sum + controller.totals.average_daily_hours, 0) / controllerData.length;

  const mostEfficient = controllerData.reduce((best, controller) =>
    controller.totals.average_daily_hours > best.totals.average_daily_hours ? controller : best,
  );

  const leastEfficient = controllerData.reduce((worst, controller) =>
    controller.totals.average_daily_hours < worst.totals.average_daily_hours ? controller : worst,
  );

  const totalPossibleHours = controllerData.length * 7 * 24;
  const totalEfficiencyPercentage = (totalOperatingHours / totalPossibleHours) * 100;

  return {
    total_operating_hours: Math.round(totalOperatingHours * 100) / 100,
    average_daily_hours: Math.round(averageDailyHours * 100) / 100,
    most_efficient_controller: mostEfficient.name,
    least_efficient_controller: leastEfficient.name,
    total_efficiency_percentage: Math.round(totalEfficiencyPercentage * 100) / 100,
  };
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
