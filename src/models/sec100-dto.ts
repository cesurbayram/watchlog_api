export interface SEC100SnapshotResponse {
  header: {
    status: number;
    message: string;
  };
  data: {
    result: number;
  };
}

export interface SEC100SnapshotResult {
  success: boolean;
  result: number;
  message: string;
  timestamp: string;
}

export interface SEC100CameraConfig {
  ipAddress: string;
  wsPort?: number;
  timeout?: number;
  username?: string;
  password?: string;
}
