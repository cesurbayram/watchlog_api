export interface SystemAlarmDetail {
  code: string;
  name: string;
  description: string;
  solution: string;
  causes: string[];
  preventiveActions: string[];
  relatedDocuments: string[];
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  robotBrand: string;
}
