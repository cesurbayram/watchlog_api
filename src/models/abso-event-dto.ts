export interface AbsoEvent {
  index: number;
  date: string;
  groupNumber: string;
  axisNumber: string;
  setValue: string;
  currValue: {
    R1: {
      S?: number;
      L?: number;
      U?: number;
      R?: number;
      B?: number;
      T?: number;
    };
  };
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface SaveAbsoEventsParams {
  controllerId: string;
  events: AbsoEvent[];
  fileModifiedAt?: Date;
}

export interface AbsoEventFromDB {
  id: string;
  controller_id: string;
  event_index: number;
  event_date: Date | null;
  group_number: string | null;
  axis_number: string | null;
  set_value: string | null;
  axis_s: number | null;
  axis_l: number | null;
  axis_u: number | null;
  axis_r: number | null;
  axis_b: number | null;
  axis_t: number | null;
  raw_entry: string | null;
  created_at: Date;
}

export interface DailyAbsoStats {
  stat_date: Date;
  total_events: number;
  axis_changes: number;
}

export interface R1Values {
  S?: number;
  L?: number;
  U?: number;
  R?: number;
  B?: number;
  T?: number;
}

export interface AbsoluteDataEntry {
  index: number;
  date: string;
  groupNumber: string;
  axisNumber: string;
  setValue: string;
  currValue: { R1: R1Values };
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface AxisComparison {
  axis: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

export interface AbsoStatistics {
  totalAbsoEvents: number;
  axisChanges: number;
  changedAxes: string[];
  lastChangeDate?: string;
  changesByAxis: Record<string, number>;
}

export interface AbsoLogsResponse {
  success: boolean;
  events: AbsoluteDataEntry[];
  comparisons: AxisComparison[];
  statistics: AbsoStatistics | null;
  error?: string;
  controllerId?: string;
  controllerName?: string;
  lastModified?: string;
  savedToDb?: boolean;
  newEventsCount?: number;
}
