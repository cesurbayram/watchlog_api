export interface ReportData {
  metadata: ReportMetadata;
  data: ReportDataSet[];
  summary?: ReportSummary;
}

export interface ReportMetadata {
  report_id: string;
  report_name: string;
  description?: string;
  generated_at: string;
  generated_by: string;
  parameters: any;
  total_records: number;
  data_sources: string[];
  date_range?: {
    start_date: string;
    end_date: string;
  };
  selected_controllers?: string[];
  controller_count?: number;
  report_type?: string;
}

export interface ReportDataSet {
  source: string;
  headers: string[];
  rows: any[][];
  total_count: number;
}

export interface ReportSummary {
  total_records: number;
  date_range: {
    start: string;
    end: string;
  };
  key_metrics: KeyMetric[];
  charts?: ChartData[];
}

export interface KeyMetric {
  name: string;
  value: string | number;
  change?: number;
  format: "number" | "percentage" | "currency" | "text";
}

export interface ChartData {
  type: "line" | "bar" | "pie" | "area";
  title: string;
  data: ChartDataPoint[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ReportTemplate {
  template_config?: {
    orientation?: "portrait" | "landscape";
    page_size?: "a4" | "letter";
  };
}
