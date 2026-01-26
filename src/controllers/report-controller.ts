import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { collectReportData } from "../utils/reports/data-collector";
import { generateReportFile } from "../utils/reports/report-generator";
import crypto from "crypto";

const generateReport = async (req: Request, res: Response) => {
  const client = await dbPool.connect();

  try {
    const { report_type_id, report_name, description, parameters, format } = req.body;

    if (!report_type_id || !report_name || !format) {
      return res.status(400).json({ message: "Report type ID, name, and format are required" });
    }

    const normalizedFormat = format.toLowerCase();
    if (!["pdf", "excel", "csv"].includes(normalizedFormat)) {
      return res.status(400).json({ message: "Invalid format. Must be pdf, excel, or csv" });
    }

    const reportTypeResult = await client.query(
      `SELECT rt.*, c.name as category_name 
       FROM report_types rt
       LEFT JOIN report_categories c ON rt.category_id = c.id
       WHERE rt.id = $1`,
      [report_type_id],
    );

    if (reportTypeResult.rows.length === 0) {
      return res.status(404).json({ message: "Report type not found" });
    }

    const reportType = reportTypeResult.rows[0];

    const reportId = crypto.randomUUID();

    let serializedParameters = "{}";
    try {
      serializedParameters = JSON.stringify(parameters || {});
    } catch (serializeError) {
      console.error("Error serializing parameters:", serializeError);

      const safeParameters = {
        ...(parameters && typeof parameters === "object" ? parameters : {}),
        toString: undefined,
        valueOf: undefined,
      };
      serializedParameters = JSON.stringify(safeParameters);
    }

    await client.query(
      `INSERT INTO generated_reports (id, user_id, report_type_id, report_name, parameters, format, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reportId, "system_user", report_type_id, report_name, serializedParameters, normalizedFormat, "processing"],
    );

    processReportGeneration(reportId, reportType, parameters, normalizedFormat, description);

    return res.status(202).json({
      report_id: reportId,
      status: "processing",
      message: "Report generation started",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error generating report:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

async function processReportGeneration(reportId: string, reportType: any, parameters: any, format: string, description?: string) {
  const client = await dbPool.connect();

  try {
    await client.query(`UPDATE generated_reports SET status = 'processing' WHERE id = $1`, [reportId]);

    const reportData = await collectReportData(reportType, parameters, description);

    const filePath = await generateReportFile(reportData, format, reportId);

    await client.query(
      `UPDATE generated_reports 
       SET file_path = $1, status = 'completed' 
       WHERE id = $2`,
      [filePath, reportId],
    );
  } catch (error: any) {
    console.error("Error in background report generation:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    await client.query(`UPDATE generated_reports SET status = 'failed' WHERE id = $1`, [reportId]);
  } finally {
    client.release();
  }
}

export { generateReport };
