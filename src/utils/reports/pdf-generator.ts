import { ReportData, ReportTemplate } from "../../models/report-data";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";

const COLORS = {
  primary: "#2563eb",
  dark: "#1e40af",
  light: "#eff6ff",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
  white: "#ffffff",
  text: "#1f2937",
  border: "#e5e7eb",
};

export async function generatePDF(reportData: ReportData, filePath: string, template?: ReportTemplate): Promise<void> {
  try {
    const originalConsoleWarn = console.warn;
    console.warn = function (message: any, ...args: any[]) {
      if (typeof message === "string" && message.includes("width could not fit page")) {
        return;
      }
      originalConsoleWarn(message, ...args);
    };

    const doc = new jsPDF({
      orientation: template?.template_config?.orientation || "portrait",
      unit: "mm",
      format: template?.template_config?.page_size || "a4",
    });

    addCleanHeader(doc, reportData, template);

    addCleanSummary(doc, reportData, template);

    let currentY = 92;
    const hasDescription = reportData.metadata.description && reportData.metadata.description.trim();
    if (hasDescription) {
      currentY += 12;
    }

    reportData.data.forEach((dataset, index) => {
      if (currentY > 240) {
        doc.addPage();
        addPageHeader(doc, reportData);
        currentY = 40;
      }

      currentY = addCleanDataSection(doc, dataset, currentY, template);
      currentY += 15;
    });

    addCleanFooter(doc, template);

    const pdfBuffer = doc.output("arraybuffer");
    fs.writeFileSync(filePath, new Uint8Array(pdfBuffer));

    console.warn = originalConsoleWarn;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

function addCleanHeader(doc: jsPDF, reportData: ReportData, template?: ReportTemplate) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setFontSize(22);
  doc.setTextColor(COLORS.white);
  doc.text(reportData.metadata.report_name, 20, 20);

  doc.setFontSize(10);
  doc.setTextColor("#e5e7eb");
  doc.text("WatchLog System Report", 20, 26);

  doc.setFontSize(9);
  const dateText = new Date(reportData.metadata.generated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  doc.text(dateText, pageWidth - 20, 18, { align: "right" });
}

function addPageHeader(doc: jsPDF, reportData: ReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(COLORS.lightGray);
  doc.rect(0, 0, pageWidth, 20, "F");

  doc.setFontSize(12);
  doc.setTextColor(COLORS.text);
  doc.text(reportData.metadata.report_name, 20, 12);
}

function addCleanSummary(doc: jsPDF, reportData: ReportData, template?: ReportTemplate) {
  const pageWidth = doc.internal.pageSize.getWidth();

  const hasDescription = reportData.metadata.description && reportData.metadata.description.trim();
  let boxHeight = 40;
  if (hasDescription) {
    boxHeight += 12;
  }

  doc.setFillColor(COLORS.light);
  doc.setDrawColor(COLORS.primary);
  doc.setLineWidth(0.5);
  doc.rect(20, 40, pageWidth - 40, boxHeight, "FD");

  doc.setFillColor(COLORS.primary);
  doc.rect(20, 40, pageWidth - 40, 12, "F");

  doc.setFontSize(12);
  doc.setTextColor(COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.text("Report Summary", 25, 48);

  let currentY = 60;
  const leftCol = 25;
  const rightCol = pageWidth / 2 + 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.gray);
  const generatedDate = new Date(reportData.metadata.generated_at).toLocaleDateString();
  const generatedTime = new Date(reportData.metadata.generated_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated: ${generatedDate} ${generatedTime}`, leftCol, currentY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.gray);
  doc.text(`Total Records: ${reportData.metadata.total_records}`, rightCol, currentY);

  currentY += 12;

  const hasDateRange = reportData.metadata.date_range;
  if (hasDateRange) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    const startDate = new Date(reportData.metadata.date_range!.start_date).toLocaleDateString();
    const endDate = new Date(reportData.metadata.date_range!.end_date).toLocaleDateString();
    doc.text(`Date Range: ${startDate} - ${endDate}`, leftCol, currentY);
  }

  const hasControllers = reportData.metadata.controller_count && reportData.metadata.controller_count > 0;
  if (hasControllers) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    const controllerText = reportData.metadata.controller_count === 1 ? "1 Controller" : `${reportData.metadata.controller_count} Controllers`;
    doc.text(`Controllers: ${controllerText}`, rightCol, currentY);
  }

  if (hasDescription) {
    currentY += 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    doc.text(`Description: ${reportData.metadata.description || ""}`, leftCol, currentY);
  }
}

function addCleanDataSection(doc: jsPDF, dataset: any, startY: number, template?: ReportTemplate): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(20, startY + 8, pageWidth - 20, startY + 8);

  doc.setFontSize(10);
  doc.setTextColor(COLORS.gray);
  doc.setFont("helvetica", "bold");
  doc.text(dataset.source, 25, startY + 6);

  if (dataset.rows && dataset.rows.length > 0) {
    const countText = `${dataset.rows.length} records`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray);
    doc.text(countText, pageWidth - 25, startY + 6, { align: "right" });
  }

  if (!dataset.rows || dataset.rows.length === 0) {
    doc.setFillColor(COLORS.lightGray);
    doc.rect(20, startY + 12, pageWidth - 40, 20, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.gray);
    doc.text("No data available", pageWidth / 2, startY + 24, {
      align: "center",
    });

    return startY + 35;
  }

  const tableData = dataset.rows.slice(0, 50).map((row: any[]) =>
    row.map((cell) => {
      if (typeof cell === "object" && cell !== null) {
        return JSON.stringify(cell);
      }
      return String(cell || "");
    }),
  );

  autoTable(doc, {
    startY: startY + 12,
    head: [dataset.headers || []],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text,
      cellPadding: 3,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    styles: {
      lineColor: COLORS.border,
      lineWidth: 0.2,
      cellPadding: 3,
      overflow: "linebreak",
      fontSize: 8,
      halign: "left",
      valign: "middle",
    },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    columnStyles: getCleanColumnStyles(dataset.headers?.length || 3),
  });

  const finalY = (doc as any).lastAutoTable.finalY || startY + 50;
  return finalY + 10;
}

function getCleanColumnStyles(columnCount: number) {
  const baseWidth = 160 / columnCount;
  const styles: any = {};

  for (let i = 0; i < columnCount; i++) {
    styles[i] = {
      cellWidth: Math.max(baseWidth, 20),
      overflow: "linebreak",
      halign: i === 0 ? "left" : "center",
      valign: "middle",
    };
  }

  return styles;
}

function addCleanFooter(doc: jsPDF, template?: ReportTemplate) {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);

    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray);

    doc.text("WatchLog System", 20, pageHeight - 12);

    const timestamp = new Date().toLocaleDateString("en-US");
    doc.text(`Generated: ${timestamp}`, pageWidth / 2, pageHeight - 12, {
      align: "center",
    });

    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 12, {
      align: "right",
    });
  }
}
