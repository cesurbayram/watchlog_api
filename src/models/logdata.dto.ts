export interface ParsedLogEntry {
  index: number;
  date?: string;
  event?: string;
  loginName?: string;
  fields: Record<string, string>;
  rawData: string;
}
