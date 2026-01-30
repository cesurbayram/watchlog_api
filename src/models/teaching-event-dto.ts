export interface TeachingEvent {
  index: number;
  date: string;
  type: "POINT_MODIFICATION" | "INSTRUCTION_INSERT" | "INSTRUCTION_DELETE" | "TEACH_MODE";
  fileName?: string;
  lineNumber?: string;
  details: string;
  rawEntry: string;
  controllerId?: string;
  controllerName?: string;
}

export interface SaveTeachingEventsParams {
  controllerId: string;
  events: TeachingEvent[];
  fileModifiedAt?: Date;
}

export interface TeachingEventFromDB {
  id: string;
  controller_id: string;
  event_index: number;
  event_date: Date | null;
  event_type: string;
  file_name: string | null;
  line_number: string | null;
  details: string | null;
  raw_entry: string | null;
  created_at: Date;
}

export interface DailyStats {
  stat_date: Date;
  point_modifications: number;
  instruction_inserts: number;
  instruction_deletes: number;
  teach_mode_activations: number;
  total_events: number;
}

export interface ComparisonResult {
  id?: string;
  file1Name: string;
  file2Name: string;
  file1Format?: string;
  file2Format?: string;
  comparisonDate?: string;
  differences: any;
  statistics: any;
}

export interface FileModification {
  fileName: string;
  count: number;
  lastTeachingDate: string;
  lastEvent: TeachingEvent;
}

export interface TeachingStatistics {
  totalTeachingEvents: number;
  pointModifications: number;
  instructionInserts: number;
  instructionDeletes: number;
  teachModeActivations: number;
  lastTeachingDate?: string;
  mostModifiedFiles: FileModification[];
}

export interface TeachingLogsResponse {
  success: boolean;
  events: TeachingEvent[];
  statistics: TeachingStatistics | null;
  error?: string;
  controllerId?: string;
  controllerName?: string;
  lastModified?: string;
  savedToDb?: boolean;
  newEventsCount?: number;
}
