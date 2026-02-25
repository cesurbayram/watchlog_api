import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportSection } from "./section-collectors.js";

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

export function renderDynamicPDF(
  title: string,
  sections: ReportSection[],
  orientation: "portrait" | "landscape" = "portrait",
): ArrayBuffer {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const dateText = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setFontSize(22);
  doc.setTextColor(COLORS.white);
  doc.text(title, 20, 20);

  doc.setFontSize(10);
  doc.setTextColor("#e5e7eb");
  doc.text("WatchLog System Report", 20, 26);

  doc.setFontSize(9);
  doc.text(dateText, pageWidth - 20, 18, { align: "right" });

  let y = 42;

  sections.forEach((section) => {
    if (y > pageHeight - 60) {
      doc.addPage();
      addPageHeader(doc, title, pageWidth);
      y = 30;
    }

    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(20, y + 8, pageWidth - 20, y + 8);

    doc.setFontSize(11);
    doc.setTextColor(COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, 25, y + 6);

    const countText = `${section.rows.length} records`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray);
    doc.text(countText, pageWidth - 25, y + 6, { align: "right" });

    if (section.rows.length === 0) {
      doc.setFillColor(COLORS.lightGray);
      doc.rect(20, y + 12, pageWidth - 40, 20, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.gray);
      doc.text(`No ${section.title.toLowerCase()} data available`, pageWidth / 2, y + 24, { align: "center" });
      y += 40;
      return;
    }

    autoTable(doc, {
      startY: y + 12,
      head: [section.headers],
      body: section.rows,
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
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray);
    doc.text("WatchLog System", 20, pageHeight - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 12, { align: "right" });
  }

  return doc.output("arraybuffer");
}

function addPageHeader(doc: jsPDF, title: string, pageWidth: number) {
  doc.setFillColor(COLORS.lightGray);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.text);
  doc.text(title, 20, 12);
}
