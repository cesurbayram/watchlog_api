export interface LogEntry {
  index: number;
  date?: string;
  event?: string;
  loginName?: string;
  fields: Record<string, string>;
  rawData: string;
}

export interface ControllerOperatingData {
  id: string;
  name: string;
  ip_address: string;
  model: string;
  application: string;
  serial_number: string;
  version: string;
  system_no: string;
  language: string;
  param_no: string;
  manipulator_type: string;
  factory: string;
  line: string;
  cell: string;
  status: string;
  operating_analysis: {
    total_log_entries: number;
    operating_rate_percentage: number;
    daily_breakdown: any[];
    system_states: {
      teach_mode: { count: number; percentage: number; average_duration_minutes: number };
      play_mode: { count: number; percentage: number; average_duration_minutes: number };
      error_state: { count: number; percentage: number; most_common_errors: string[] };
      idle_state: { count: number; percentage: number };
    };
    critical_events: {
      total_count: number;
      events_per_day: number;
      top_critical_events: any[];
      recent_critical_events: any[];
    };
    performance_trend: number;
  };
  first_5_logs: LogEntry[];
}

export interface OperatingRateReportData {
  metadata: {
    title: string;
    generated_at: string;
    period: string;
    total_controllers: number;
    shifts: { name: string; start: string; end: string }[];
  };
  controllers: ControllerOperatingData[];
  summary: {
    overall_operating_rate: number;
    total_log_entries: number;
    total_critical_events: number;
    most_efficient_controller: string;
    least_efficient_controller: string;
    average_daily_operating_rate: number;
  };
}
