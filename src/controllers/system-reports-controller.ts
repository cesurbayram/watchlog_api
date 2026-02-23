import { Request, Response } from "express";
import { collectSection, getAvailableSections } from "../utils/reports/section-collectors.js";
import { renderDynamicPDF } from "../utils/reports/dynamic-pdf-renderer.js";

const generateReport = async (req: Request, res: Response) => {
  try {
    const { sections, controllerIds, timeRange = "7d", title } = req.body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: "sections array is required",
        availableSections: getAvailableSections(),
      });
    }

    const parsedControllerIds = controllerIds && Array.isArray(controllerIds) ? controllerIds : undefined;

    const collectedSections = await Promise.all(
      sections.map((key: string) => collectSection(key, parsedControllerIds, timeRange)),
    );

    const validSections = collectedSections.filter((s) => s !== null);

    if (validSections.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid sections found",
        availableSections: getAvailableSections(),
      });
    }

    const pdfBuffer = renderDynamicPDF(title || "System Report", validSections);

    const fileName = `system_report_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.byteLength);

    return res.send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error("Error generating report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate report",
      details: error.message,
    });
  }
};

const getAvailableReportSections = async (_req: Request, res: Response) => {
  const available = getAvailableSections();
  return res.json({
    success: true,
    sections: available,
  });
};

export { generateReport, getAvailableReportSections };
