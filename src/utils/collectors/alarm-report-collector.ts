import { dbPool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import os from "os";
import { parse } from "csv-parse/sync";
import { AlarmReportData, ControllerAlarmData, AlarmEntry, AlarmCodeMapping } from "../../models/alarm-report-dto";

function getAlarmDetailsDirectory(): string {
  return (
    process.env.WATCHLOG_ALARM_DETAILS_DIR ||
    (process.platform === "win32" ? "C:\\Watchlog\\AlarmDetails" : path.join(os.homedir(), "Watchlog", "AlarmDetails"))
  );
}

export async function collectAlarmReportData(
  controllerIds?: string[],
  timeRange: "24h" | "7d" | "shift" = "7d",
  shiftId?: string,
): Promise<AlarmReportData> {
  const client = await dbPool.connect();

  try {
    const daysToFetch = timeRange === "24h" ? 1 : timeRange === "shift" ? 1 : 7;

    const controllersQuery =
      controllerIds && controllerIds.length > 0
        ? `
            SELECT 
              c.id, 
              c.name, 
              c.ip_address
            FROM controller c
            WHERE c.id = ANY($1)
            ORDER BY c.ip_address
          `
        : `
            SELECT 
              c.id, 
              c.name, 
              c.ip_address
            FROM controller c
            ORDER BY c.ip_address
          `;

    const controllersResult =
      controllerIds && controllerIds.length > 0 ? await client.query(controllersQuery, [controllerIds]) : await client.query(controllersQuery);
    const controllers = controllersResult.rows;

    if (controllers.length === 0) {
      throw new Error("No controllers found");
    }

    const controllerData: ControllerAlarmData[] = [];

    for (const controller of controllers) {
      const totalQuery = `
        SELECT COUNT(*) as total_count
        FROM almhist
        WHERE controller_id = $1
          AND origin_date >= NOW() - INTERVAL '${daysToFetch} days'
      `;
      const totalResult = await client.query(totalQuery, [controller.id]);
      const totalCount = parseInt(totalResult.rows[0]?.total_count || "0");

      const alarmsQuery = `
        SELECT 
          code,
          name,
          type,
          origin_date
        FROM almhist
        WHERE controller_id = $1
          AND origin_date >= NOW() - INTERVAL '${daysToFetch} days'
        ORDER BY origin_date DESC
        LIMIT 5
      `;
      const alarmsResult = await client.query(alarmsQuery, [controller.id]);

      const recentAlarms: AlarmEntry[] = alarmsResult.rows.map((row: any) => ({
        code: row.code || "N/A",
        name: row.name || "N/A",
        type: row.type || "N/A",
        origin_date: row.origin_date || "N/A",
        mode: "",
        details: {
          alarm_number: "",
          alarm_name: "",
          contents: "",
          sub_code: "",
          meaning: "",
          cause: "",
          remedy: "",
          notes: "",
        },
      }));

      controllerData.push({
        id: controller.id,
        name: controller.name,
        ip_address: controller.ip_address,
        model: "",
        recent_alarms: recentAlarms,
        alarm_summary: {
          total_count: totalCount,
          critical_count: 0,
          most_frequent_code: "",
          last_alarm_date: recentAlarms.length > 0 ? recentAlarms[0].origin_date : "N/A",
          last_alarm_code: recentAlarms.length > 0 ? recentAlarms[0].code : "N/A",
          last_alarm_name: recentAlarms.length > 0 ? recentAlarms[0].name : "N/A",
        },
      });
    }

    const summary = calculateAlarmSummary(controllerData);

    const periodText = timeRange === "24h" ? "Last 24 Hours" : timeRange === "shift" ? "Current Shift" : "Last 7 Days";

    return {
      metadata: {
        title: "Robot Alarm Analysis Report",
        generated_at: new Date().toISOString(),
        period: periodText,
        total_controllers: controllers.length,
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
          c.ip_address,
          c.model
        FROM controller c
        ORDER BY c.name
      `;

      const fallbackResult = await client.query(fallbackQuery);

      return {
        metadata: {
          title: "Robot Alarm Analysis Report",
          generated_at: new Date().toISOString(),
          period: "Recent Alarms (Last 5 per Robot)",
          total_controllers: fallbackResult.rows.length || 0,
        },
        controllers: [],
        summary: {
          total_alarms: 0,
          critical_alarms: 0,
          most_problematic_controller: "N/A - No Data Available",
          most_common_alarm_code: "N/A - No Data Available",
          average_alarms_per_controller: 0,
        },
      };
    } catch (fallbackError) {
      return {
        metadata: {
          title: "Robot Alarm Analysis Report",
          generated_at: new Date().toISOString(),
          period: "Recent Alarms (Last 5 per Robot)",
          total_controllers: 0,
        },
        controllers: [],
        summary: {
          total_alarms: 0,
          critical_alarms: 0,
          most_problematic_controller: "N/A - No Data Available",
          most_common_alarm_code: "N/A - No Data Available",
          average_alarms_per_controller: 0,
        },
      };
    }
  } finally {
    client.release();
  }
}

function calculateAlarmSummary(controllerData: ControllerAlarmData[]) {
  if (controllerData.length === 0) {
    return {
      total_alarms: 0,
      critical_alarms: 0,
      most_problematic_controller: "N/A",
      most_common_alarm_code: "N/A",
      average_alarms_per_controller: 0,
    };
  }

  const totalAlarms = controllerData.reduce((sum, controller) => sum + controller.alarm_summary.total_count, 0);

  const criticalAlarms = controllerData.reduce((sum, controller) => sum + controller.alarm_summary.critical_count, 0);

  const mostProblematic = controllerData.reduce((worst, controller) =>
    controller.alarm_summary.total_count > worst.alarm_summary.total_count ? controller : worst,
  );

  const allCodes: { [code: string]: number } = {};
  controllerData.forEach((controller) => {
    controller.recent_alarms.forEach((alarm) => {
      allCodes[alarm.code] = (allCodes[alarm.code] || 0) + 1;
    });
  });

  const mostCommonCode = Object.entries(allCodes).sort((a, b) => b[1] - a[1])[0];

  return {
    total_alarms: totalAlarms,
    critical_alarms: criticalAlarms,
    most_problematic_controller: mostProblematic.name,
    most_common_alarm_code: mostCommonCode ? mostCommonCode[0] : "N/A",
    average_alarms_per_controller: Math.round((totalAlarms / controllerData.length) * 100) / 100,
  };
}

export async function loadAlarmDetailMappings(): Promise<{
  [model: string]: AlarmCodeMapping;
}> {
  const mappings: { [model: string]: AlarmCodeMapping } = {};

  try {
    const alarmDetailsPath = getAlarmDetailsDirectory();

    if (!fs.existsSync(alarmDetailsPath)) {
      return mappings;
    }

    const modelDirs = fs
      .readdirSync(alarmDetailsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const modelDir of modelDirs) {
      const modelPath = path.join(alarmDetailsPath, modelDir);
      const modelMapping: AlarmCodeMapping = {};

      try {
        const csvFiles = fs.readdirSync(modelPath).filter((file) => file.endsWith(".csv"));

        for (const csvFile of csvFiles) {
          const csvPath = path.join(modelPath, csvFile);
          const csvContent = fs.readFileSync(csvPath, "utf-8");

          const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            from_line: 4,
          });

          records.forEach((record: any) => {
            const alarmNumber = record["Alarm Number"];
            if (alarmNumber && alarmNumber !== "" && alarmNumber !== "Alarm Number") {
              const alarmDetails = {
                alarm_number: alarmNumber,
                alarm_name: record["Alarm Name/Message"] || record["Alarm Name"] || "",
                contents: record["Contents"] || "",
                sub_code: record["Sub Code"] || "",
                meaning: record["Meaning"] || "",
                cause: record["Cause"] || "",
                remedy: record["Remedy"] || "",
                notes: record["Notes"] || "",
              };
              modelMapping[alarmNumber] = alarmDetails;
            }
          });
        }

        mappings[modelDir] = modelMapping;
      } catch (error) {}
    }
  } catch (error) {}

  return mappings;
}
