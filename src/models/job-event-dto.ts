import { JobChangeType } from "./mongo/job-change-event.model";

export interface JobChangeEventDto {
  id: string;
  controllerId: string;
  controllerName?: string;
  jobName: string;
  detectedAt: string;
  changeType: JobChangeType;
  diff?: string;
  previousContentHash?: string;
  newContentHash?: string;
}

export interface JobLogsResponse {
  success: boolean;
  events: JobChangeEventDto[];
  error?: string;
  controllerId?: string;
  controllerName?: string;
  total?: number;
  limit?: number;
  offset?: number;
}
