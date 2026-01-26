import { ReportData } from "../../models/report-data";
import fs from "fs";

export async function generateCSV(reportData: ReportData, filePath: string): Promise<void> {
  try {
    const csvContent = generateCSVContent(reportData);
    fs.writeFileSync(filePath, csvContent);
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw error;
  }
}

function generateCSVContent(reportData: ReportData): string {
  let content = "";

  content += "REPORT SUMMARY\n";
  content += "=============\n";
  content += `Report Name,${escapeCSV(reportData.metadata.report_name)}\n`;
  content += `Generated At,${new Date(reportData.metadata.generated_at).toLocaleString()}\n`;
  content += `Total Records,${reportData.metadata.total_records}\n`;
  content += `Data Sources,${escapeCSV(reportData.metadata.data_sources.join(", "))}\n`;

  if (reportData.metadata.date_range) {
    const startDate = new Date(reportData.metadata.date_range.start_date).toLocaleDateString();
    const endDate = new Date(reportData.metadata.date_range.end_date).toLocaleDateString();
    content += `Date Range,${startDate} - ${endDate}\n`;
  }

  if (reportData.metadata.description) {
    content += `Description,${escapeCSV(reportData.metadata.description)}\n`;
  }

  content += "\n";

  reportData.data.forEach((dataset, index) => {
    if (index > 0) content += "\n";

    content += `${dataset.source.toUpperCase()}\n`;
    content += "=".repeat(dataset.source.length) + "\n";
    content += `Total Count,${dataset.total_count}\n`;
    content += "\n";

    content += dataset.headers.map((header) => escapeCSV(header)).join(",") + "\n";

    dataset.rows.forEach((row) => {
      const csvRow = row.map((cell) => escapeCSV(String(cell || ""))).join(",");
      content += csvRow + "\n";
    });

    content += "\n";
  });

  return content;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
