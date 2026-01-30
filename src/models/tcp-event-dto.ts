export interface ParsedElement {
  toolNumber: number;
  parameterGroup: number;
  parameterGroupName: string;
  parameterIndex: number;
  parameterName: string;
  actualToolNumber: number;
}

export interface TCPEvent {
  index: number;
  date: string;
  event: string;
  fileName: string;
  elementNumber: string;
  elementValue: string;
  parsedElement: ParsedElement;
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface SaveTCPEventsParams {
  controllerId: string;
  events: TCPEvent[];
  fileModifiedAt?: Date;
}

export interface TCPEventFromDB {
  id: string;
  controller_id: string;
  event_index: number;
  event_date: Date | null;
  event_name: string | null;
  file_name: string | null;
  element_number: string | null;
  element_value: string | null;
  tool_number: number | null;
  parameter_group: number | null;
  parameter_group_name: string | null;
  parameter_index: number | null;
  parameter_name: string | null;
  raw_entry: string | null;
  created_at: Date;
}

export interface DailyTCPStats {
  stat_date: Date;
  total_events: number;
  tools_modified: number;
}

export interface TCPDataEntry {
  index: number;
  date: string;
  event: string;
  fileName: string;
  elementNumber: string;
  elementValue: string;
  parsedElement: ParsedElement;
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface TCPComparison {
  toolNumber: number;
  parameterName: string;
  parameterGroupName: string;
  elementNumber: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

export interface TCPStatistics {
  totalTCPChanges: number;
  toolsModified: number;
  uniqueTools: string[];
  lastChangeDate?: string;
  changesByParameter: Record<string, number>;
}

export interface TCPLogsResponse {
  success: boolean;
  events: TCPDataEntry[];
  comparisons: TCPComparison[];
  statistics: TCPStatistics | null;
  error?: string;
  controllerId?: string;
  controllerName?: string;
  lastModified?: string;
  savedToDb?: boolean;
  newEventsCount?: number;
}
