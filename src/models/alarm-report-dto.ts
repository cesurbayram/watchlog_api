export interface AlarmDetails {
  alarm_number: string;
  alarm_name: string;
  contents: string;
  sub_code: string;
  meaning: string;
  cause: string;
  remedy: string;
  notes: string;
}

export interface AlarmCodeMapping {
  [code: string]: AlarmDetails;
}

export interface AlarmEntry {
  code: string;
  name: string;
  type: string;
  origin_date: string;
  mode: string;
  details: AlarmDetails;
}

export interface ControllerAlarmData {
  id: string;
  name: string;
  ip_address: string;
  model: string;
  recent_alarms: AlarmEntry[];
  alarm_summary: {
    total_count: number;
    critical_count: number;
    most_frequent_code: string;
    last_alarm_date: string;
    last_alarm_code: string;
    last_alarm_name: string;
  };
}

export interface AlarmReportData {
  metadata: {
    title: string;
    generated_at: string;
    period: string;
    total_controllers: number;
  };
  controllers: ControllerAlarmData[];
  summary: {
    total_alarms: number;
    critical_alarms: number;
    most_problematic_controller: string;
    most_common_alarm_code: string;
    average_alarms_per_controller: number;
  };
}
