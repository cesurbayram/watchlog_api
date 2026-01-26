import { ReportData, ReportMetadata } from "../../models/report-data";
import { dbPool } from "../../config/db";
import crypto from "crypto";

export async function collectReportData(reportType: any, parameters: any, description?: string): Promise<ReportData> {
  const metadata: ReportMetadata = {
    report_id: crypto.randomUUID(),
    report_name: reportType.name,
    description: description,
    generated_at: new Date().toISOString(),
    generated_by: "system_user",
    parameters,
    total_records: 0,
    data_sources: [reportType.name],
    date_range: parameters.date_range
      ? {
          start_date: parameters.date_range.start_date,
          end_date: parameters.date_range.end_date,
        }
      : undefined,
    selected_controllers: parameters.controller_ids || [],
    controller_count: parameters.controller_ids ? parameters.controller_ids.length : 0,
    report_type: reportType.name,
  };

  const data = [];

  switch (reportType.id) {
    case "system-all-data":
      metadata.report_name = "System Report";
      data.push(await collectControllerData(parameters));
      data.push(await collectAlarmData(parameters));
      data.push(await collectBackupPlansData(parameters));
      data.push(await collectJobsData(parameters));
      data.push(await collectUtilizationData(parameters));
      break;

    case "maintenance-all-data":
      metadata.report_name = "Maintenance Report";
      data.push(await collectControllerData(parameters));
      data.push(await collectShiftsData(parameters));
      data.push(await collectMaintenanceHistoryData(parameters));
      break;

    case "production-all-data":
      metadata.report_name = "Production Report";
      data.push(await collectControllerData(parameters));
      data.push(await collectShiftsData(parameters));
      data.push(await collectProductionValuesData(parameters));
      data.push(await collectControllerPerformanceData(parameters));
      break;

    case "general-all-data":
      metadata.report_name = "General System Summary";
      data.push(await collectGeneralSummaryData(parameters));
      break;

    default:
      data.push(await collectControllerData(parameters));
      break;
  }

  metadata.total_records = data.reduce((sum, ds) => sum + ds.total_count, 0);

  return {
    metadata,
    data,
  };
}

async function collectControllerData(parameters: any) {
  try {
    let query = `
      SELECT 
        c.id,
        c.name,
        c.model,
        c.status,
        c.location,
        c.ip_address,
        c.application,
        c.created_at
      FROM controller c
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    query += ` ORDER BY c.name`;

    const result = await dbPool.query(query, queryParams);

    let controllerSelection = "All Controllers";
    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      const selectedNames = result.rows.map((row) => row.name).join(", ");
      controllerSelection = selectedNames || `Selected Controllers: ${parameters.controller_ids.length}`;
    }

    return {
      source: `Controllers (${controllerSelection})`,
      headers: ["Name", "Model", "Status", "Location", "IP Address", "Application", "Created"],
      rows:
        result.rows.length > 0
          ? result.rows.map((row) => [row.name, row.model, row.status, row.location, row.ip_address, row.application, new Date(row.created_at).toLocaleDateString()])
          : [["No controller data found for the selected criteria"]],
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting controller data:", error);
    return {
      source: "Controllers",
      headers: ["Error"],
      rows: [["Controller data collection failed"]],
      total_count: 0,
    };
  }
}

async function collectAlarmData(parameters: any) {
  try {
    let query = `
      SELECT 
        c.name as controller_name,
        a.code,
        a.text,
        a.detected,
        a.removed,
        a.origin_date
      FROM alarm a
      LEFT JOIN controller c ON a.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.startDate && parameters.endDate) {
      query += ` AND a.origin_date >= $${paramIndex} AND a.origin_date <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    query += ` ORDER BY a.origin_date DESC LIMIT 100`;

    const result = await dbPool.query(query, queryParams);

    let controllerInfo = "All Controllers";
    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      const uniqueNames = new Set(result.rows.map((row) => row.controller_name).filter((name) => name));
      const selectedNames = Array.from(uniqueNames);
      controllerInfo = selectedNames.length > 0 ? selectedNames.join(", ") : `Selected Controllers: ${parameters.controller_ids.length}`;
    }

    return {
      source: `Alarms (${controllerInfo})`,
      headers: ["Controller", "Code", "Text", "Detected", "Removed", "Date"],
      rows:
        result.rows.length > 0
          ? result.rows.map((row) => [
              row.controller_name || "N/A",
              row.code || "N/A",
              row.text || "N/A",
              row.detected ? "Yes" : "No",
              row.removed ? "Yes" : "No",
              row.origin_date ? new Date(row.origin_date).toLocaleString("en-US") : "N/A",
            ])
          : [["No alarm data found for the selected criteria"]],
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting alarm data:", error);
    return {
      source: "Alarms",
      headers: ["Error"],
      rows: [["Alarm data collection failed"]],
      total_count: 0,
    };
  }
}

async function collectBackupPlansData(parameters: any) {
  try {
    let query = `
      SELECT 
        c.name as controller_name,
        bp.name,
        bp.days,
        bp.time,
        bp.file_types,
        bp.is_active,
        bp.created_at
      FROM backup_plans bp
      LEFT JOIN controller c ON bp.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    if (parameters.startDate && parameters.endDate) {
      query += ` AND bp.created_at >= $${paramIndex} AND bp.created_at <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    query += ` ORDER BY bp.created_at DESC LIMIT 50`;

    const result = await dbPool.query(query, queryParams);

    return {
      source: "Backup Plans",
      headers: ["Controller", "Plan Name", "Days", "Time", "File Types", "Status", "Created"],
      rows: result.rows.map((row) => [
        row.controller_name || "N/A",
        row.name || "N/A",
        Array.isArray(row.days) ? row.days.join(", ") : row.days || "N/A",
        row.time || "N/A",
        Array.isArray(row.file_types) ? row.file_types.join(", ") : row.file_types || "N/A",
        row.is_active ? "Active" : "Inactive",
        row.created_at ? new Date(row.created_at).toLocaleString("en-US") : "N/A",
      ]),
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting backup plans data:", error);
    return {
      source: "Backup Plans",
      headers: ["Controller", "Plan Name", "Days", "Time", "File Types", "Status", "Created"],
      rows: [["Backup plans data collection failed", "-", "-", "-", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectJobsData(parameters: any) {
  try {
    const tableExists = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'job'
      );
    `);

    if (!tableExists.rows[0]?.exists) {
      return {
        source: "Jobs",
        headers: ["Job ID", "Job Name", "Description", "Status", "Created"],
        rows: [["No job table found", "-", "-", "-", "-"]],
        total_count: 0,
      };
    }

    let query = `
      SELECT 
        c.name as controller_name,
        j.job_name,
        j.last_modified,
        j.created_at
      FROM job j
      LEFT JOIN controller c ON j.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    query += ` ORDER BY j.last_modified DESC LIMIT 50`;

    const result = await dbPool.query(query, queryParams);

    return {
      source: "Jobs",
      headers: ["Controller", "Job Name", "Last Modified", "Created"],
      rows: result.rows.map((row) => [
        row.controller_name || "N/A",
        row.job_name || "N/A",
        row.last_modified ? new Date(row.last_modified).toLocaleString("en-US") : "N/A",
        row.created_at ? new Date(row.created_at).toLocaleString("en-US") : "N/A",
      ]),
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting jobs data:", error);
    return {
      source: "Jobs",
      headers: ["Controller", "Job Name", "Last Modified", "Created"],
      rows: [["Jobs data collection failed", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectUtilizationData(parameters: any) {
  try {
    const tableExists = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'utilization'
      );
    `);

    if (!tableExists.rows[0]?.exists) {
      return {
        source: "Utilization",
        headers: ["Controller", "Servo Time (h)", "Controller Time (h)", "Idle Time (h)", "Running Time (h)", "Recorded"],
        rows: [["No utilization table found", "-", "-", "-", "-", "-"]],
        total_count: 0,
      };
    }

    let query = `
      SELECT 
        c.name as controller_name,
        u.servo_power_time,
        u.controller_power_time,
        u.idle_time,
        u.running_time,
        u.recorded_at
      FROM utilization u
      LEFT JOIN controller c ON u.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.startDate && parameters.endDate) {
      query += ` AND u.recorded_at >= $${paramIndex} AND u.recorded_at <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    query += ` ORDER BY u.recorded_at DESC LIMIT 100`;

    const result = await dbPool.query(query, queryParams);

    return {
      source: "Utilization",
      headers: ["Controller", "Servo Time (h)", "Controller Time (h)", "Idle Time (h)", "Running Time (h)", "Recorded"],
      rows: result.rows.map((row) => [
        row.controller_name || "N/A",
        `${row.servo_power_time || 0}`,
        `${row.controller_power_time || 0}`,
        `${row.idle_time || 0}`,
        `${row.running_time || 0}`,
        row.recorded_at ? new Date(row.recorded_at).toLocaleString("en-US") : "N/A",
      ]),
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting utilization data:", error);
    return {
      source: "Utilization",
      headers: ["Controller", "Servo Time (h)", "Controller Time (h)", "Idle Time (h)", "Running Time (h)", "Recorded"],
      rows: [["Utilization data collection failed", "-", "-", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectShiftsData(parameters: any) {
  try {
    let query = `
      SELECT 
        s.name,
        s.shift_start,
        s.shift_end,
        s.created_at
      FROM shift s
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.startDate && parameters.endDate) {
      query += ` AND s.created_at >= $${paramIndex} AND s.created_at <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    query += ` ORDER BY s.created_at DESC LIMIT 50`;

    const result = await dbPool.query(query, queryParams);

    return {
      source: "Shifts",
      headers: ["Shift Name", "Start Time", "End Time", "Created"],
      rows: result.rows.map((row) => [row.name || "N/A", row.shift_start || "N/A", row.shift_end || "N/A", row.created_at ? new Date(row.created_at).toLocaleString("en-US") : "N/A"]),
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting shifts data:", error);
    return {
      source: "Shifts",
      headers: ["Shift Name", "Start Time", "End Time", "Created"],
      rows: [["Shifts data collection failed", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectMaintenanceHistoryData(parameters: any) {
  try {
    let query = `
      SELECT 
        c.name as controller_name,
        mh.maintenance_type,
        mh.maintenance_date,
        mh.servo_hours,
        mh.technician,
        mh.notes,
        mh.created_at
      FROM maintenance_history mh
      LEFT JOIN controller c ON mh.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    if (parameters.startDate && parameters.endDate) {
      query += ` AND mh.maintenance_date >= $${paramIndex} AND mh.maintenance_date <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    query += ` ORDER BY mh.maintenance_date DESC LIMIT 50`;

    const result = await dbPool.query(query, queryParams);

    let controllerInfo = "All Controllers";
    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      const uniqueNames = new Set(result.rows.map((row) => row.controller_name).filter((name) => name));
      const selectedNames = Array.from(uniqueNames);
      controllerInfo = selectedNames.length > 0 ? selectedNames.join(", ") : `Selected Controllers: ${parameters.controller_ids.length}`;
    }

    return {
      source: `Maintenance History (${controllerInfo})`,
      headers: ["Controller", "Type", "Date", "Servo Hours", "Technician", "Notes", "Created"],
      rows:
        result.rows.length > 0
          ? result.rows.map((row) => [
              row.controller_name || "N/A",
              row.maintenance_type || "N/A",
              row.maintenance_date ? new Date(row.maintenance_date).toLocaleDateString("en-US") : "N/A",
              row.servo_hours ? row.servo_hours.toLocaleString() : "0",
              row.technician || "N/A",
              row.notes || "-",
              row.created_at ? new Date(row.created_at).toLocaleString("en-US") : "N/A",
            ])
          : [["No maintenance data found for the selected criteria"]],
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting maintenance history data:", error);
    return {
      source: "Maintenance History",
      headers: ["Controller", "Type", "Date", "Servo Hours", "Technician", "Notes", "Created"],
      rows: [["Maintenance history data collection failed", "-", "-", "-", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectProductionValuesData(parameters: any) {
  try {
    let query = `
      SELECT 
        c.name as controller_name,
        s.name as shift_name,
        j.name as job_name,
        pv.produced_product_count,
        pv.note,
        pv.created_at
      FROM production_value pv
      LEFT JOIN controller c ON pv.controller_id = c.id
      LEFT JOIN shift s ON pv.shift_id = s.id
      LEFT JOIN job_select j ON pv.job_id = j.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.startDate && parameters.endDate) {
      query += ` AND pv.created_at >= $${paramIndex} AND pv.created_at <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    query += ` ORDER BY pv.created_at DESC LIMIT 100`;

    const result = await dbPool.query(query, queryParams);

    let controllerInfo = "All Controllers";
    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      const uniqueNames = new Set(result.rows.map((row) => row.controller_name).filter((name) => name));
      const selectedNames = Array.from(uniqueNames);
      controllerInfo = selectedNames.length > 0 ? selectedNames.join(", ") : `Selected Controllers: ${parameters.controller_ids.length}`;
    }

    return {
      source: `Production Values (${controllerInfo})`,
      headers: ["Controller", "Shift", "Job", "Product Count", "Note", "Date"],
      rows:
        result.rows.length > 0
          ? result.rows.map((row) => [
              row.controller_name || "N/A",
              row.shift_name || "N/A",
              row.job_name || "N/A",
              row.produced_product_count || "0",
              row.note || "-",
              row.created_at ? new Date(row.created_at).toLocaleString("en-US") : "N/A",
            ])
          : [["No production data found for the selected criteria"]],
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting production values data:", error);
    return {
      source: "Production Values",
      headers: ["Controller", "Shift", "Job", "Product Count", "Note", "Date"],
      rows: [["Production values data collection failed", "-", "-", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectControllerPerformanceData(parameters: any) {
  try {
    const tableExists = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'utilization'
      );
    `);

    if (!tableExists.rows[0]?.exists) {
      return {
        source: "Controller Performance",
        headers: ["Controller", "Avg Running Time (h)", "Avg Idle Time (h)", "Last Record", "Total Records"],
        rows: [["No utilization table found", "-", "-", "-", "-"]],
        total_count: 0,
      };
    }

    let query = `
      SELECT 
        c.name as controller_name,
        AVG(u.running_time) as avg_running_time,
        AVG(u.idle_time) as avg_idle_time,
        MAX(u.recorded_at) as last_recorded,
        COUNT(u.id) as record_count
      FROM utilization u
      LEFT JOIN controller c ON u.controller_id = c.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (parameters.controller_ids && parameters.controller_ids.length > 0) {
      query += ` AND c.id = ANY($${paramIndex})`;
      queryParams.push(parameters.controller_ids);
      paramIndex++;
    }

    if (parameters.startDate && parameters.endDate) {
      query += ` AND u.recorded_at >= $${paramIndex} AND u.recorded_at <= $${paramIndex + 1}`;
      queryParams.push(parameters.startDate, parameters.endDate);
      paramIndex += 2;
    }

    query += ` GROUP BY c.name ORDER BY avg_running_time DESC`;

    const result = await dbPool.query(query, queryParams);

    return {
      source: "Controller Performance",
      headers: ["Controller", "Avg Running Time (h)", "Avg Idle Time (h)", "Last Record", "Total Records"],
      rows: result.rows.map((row) => [
        row.controller_name || "N/A",
        row.avg_running_time ? Number(row.avg_running_time).toFixed(2) : "0",
        row.avg_idle_time ? Number(row.avg_idle_time).toFixed(2) : "0",
        row.last_recorded ? new Date(row.last_recorded).toLocaleString("en-US") : "N/A",
        row.record_count || 0,
      ]),
      total_count: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error collecting controller performance data:", error);
    return {
      source: "Controller Performance",
      headers: ["Controller", "Avg Running Time (h)", "Avg Idle Time (h)", "Last Record", "Total Records"],
      rows: [["Controller performance data collection failed", "-", "-", "-", "-"]],
      total_count: 0,
    };
  }
}

async function collectGeneralSummaryData(parameters: any) {
  try {
    const controllerCount = await dbPool.query("SELECT COUNT(*) as count FROM controller");
    const alarmCount = await dbPool.query("SELECT COUNT(*) as count FROM alarm WHERE removed IS NULL");
    const backupPlansCount = await dbPool.query("SELECT COUNT(*) as count FROM backup_plans");
    let jobCount;
    try {
      jobCount = await dbPool.query("SELECT COUNT(*) as count FROM job");
    } catch (error) {
      jobCount = { rows: [{ count: 0 }] };
    }
    const shiftCount = await dbPool.query("SELECT COUNT(*) as count FROM shift");
    const productionCount = await dbPool.query("SELECT COUNT(*) as count FROM production_value");
    const maintenanceCount = await dbPool.query("SELECT COUNT(*) as count FROM maintenance_history");

    return {
      source: "System Summary",
      headers: ["Category", "Count", "Description"],
      rows: [
        ["Controllers", controllerCount.rows[0]?.count || 0, "Total controllers in system"],
        ["Active Alarms", alarmCount.rows[0]?.count || 0, "Unresolved alarms"],
        ["Backup Plans", backupPlansCount.rows[0]?.count || 0, "Total backup plans"],
        ["Jobs", jobCount.rows[0]?.count || 0, "Total jobs"],
        ["Shifts", shiftCount.rows[0]?.count || 0, "Defined shifts"],
        ["Production Records", productionCount.rows[0]?.count || 0, "Production value entries"],
        ["Maintenance Records", maintenanceCount.rows[0]?.count || 0, "Maintenance history entries"],
        ["System Status", "Active", "Overall system operational status"],
      ],
      total_count: 8,
    };
  } catch (error) {
    console.error("Error collecting general summary data:", error);
    return {
      source: "System Summary",
      headers: ["Error"],
      rows: [["General summary data collection failed"]],
      total_count: 0,
    };
  }
}
