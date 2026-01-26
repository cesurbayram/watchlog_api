import { ReportData } from "../../models/report-data";
import * as XLSX from "xlsx";

export async function generateExcel(reportData: ReportData, filePath: string): Promise<void> {
  try {
    const workbook = XLSX.utils.book_new();

    addSummarySheet(workbook, reportData);

    reportData.data.forEach((dataset, index) => {
      addDataSheet(workbook, dataset, index);
    });

    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.error("Error generating Excel:", error);
    throw error;
  }
}

function addSummarySheet(workbook: XLSX.WorkBook, reportData: ReportData) {
  const summaryData: (string | number)[][] = [
    ["Report Summary"],
    [""],
    ["Report Name", reportData.metadata.report_name],
    ["Generated At", new Date(reportData.metadata.generated_at).toLocaleString()],
    ["Total Records", reportData.metadata.total_records],
    ["Data Sources", reportData.metadata.data_sources.join(", ")],
  ];

  if (reportData.metadata.date_range) {
    summaryData.push([
      "Date Range",
      `${new Date(reportData.metadata.date_range.start_date).toLocaleDateString()} - ${new Date(reportData.metadata.date_range.end_date).toLocaleDateString()}`,
    ]);
  }

  if (reportData.metadata.description) {
    summaryData.push(["Description", reportData.metadata.description]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  summarySheet["!cols"] = [{ wch: 20 }, { wch: 50 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
}

function addDataSheet(workbook: XLSX.WorkBook, dataset: any, index: number) {
  const sheetData = [[dataset.source], [`Total Count: ${dataset.total_count}`], [""], dataset.headers, ...dataset.rows];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  const colWidths = dataset.headers.map((header: string) => ({
    wch: Math.max(header.length + 2, 12),
  }));
  worksheet["!cols"] = colWidths;

  const sheetName = dataset.source.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}
