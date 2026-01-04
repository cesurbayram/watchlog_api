export interface LogEntry {
  index: number;
  date?: string;
  event?: string;
  loginName?: string;
  fields: Record<string, string>;
  rawData: string;
}

export interface LogFileContentResponse {
  success: boolean;
  data?: LogEntry[];
  error?: string;
  filePath?: string;
  lastModified?: string;
}

export interface LogContentDisplayProps {
  controllerId: string;
  isVisible: boolean;
  refreshTrigger?: number;
}
