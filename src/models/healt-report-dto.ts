export interface ControllerStatusData {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  location: string;
  application: string;
  version?: string;
  language?: string;
  param_no?: string;
  manipulator_type?: string;
  factory?: string;
  line?: string;
  cell?: string;
  serial_number?: string;
  status: string;
  isOnline: boolean;
  servo: boolean;
  operating: boolean;
  teach: string;
  alarm: boolean;
  error: boolean;
  hold: boolean;
  doorOpen: boolean;
  connection: boolean;
  lastUpdate: string;
  shiftStatusData?: any[];
  servoHours?: number;
}

export interface PerformanceAnalysis {
  currentPeriod: {
    avgServoTime: number;
    avgControlPowerTime: number;
    avgPlaybackTime: number;
    avgMovingTime: number;
    avgOperatingTime: number;
    totalRecords: number;
  };
  previousPeriod: {
    avgServoTime: number;
    avgControlPowerTime: number;
    avgPlaybackTime: number;
    avgMovingTime: number;
    avgOperatingTime: number;
    totalRecords: number;
  };
  comparison: {
    servoTimeDiff: number;
    servoTimeDiffPercent: number;
    operatingTimeDiff: number;
    operatingTimeDiffPercent: number;
  };
  weeklyTrend: { date: string; avgServoTime: number; avgOperatingTime: number }[];
  robotPerformances: {
    controllerName: string;
    servoTime: number;
    efficiency: number;
    operatingTime: number;
  }[];
}

export interface AlarmAnalysis {
  totalLast24h: number;
  activeAlarms: number;
  topAlarmCodes: { code: string; text: string; count: number; severity: string }[];
  severityDistribution: { major: number; minor: number };
  recentAlarms: {
    controllerName: string;
    code: string;
    text: string;
    detected: string;
    removed: string | null;
    severity: string;
  }[];
  alarmsByController: { controllerName: string; alarmCount: number }[];
  last3AlarmsByRobot?: any[];
}

export interface BackupStatus {
  controllersWithBackup: number;
  controllersWithoutBackup: number;
  totalBackupSessions: number;
  successRate: number;
  backupDetails: any[];
  missingBackups: string[];
}

export interface ProductionSummary {
  totalProductionToday: number;
  totalProductionYesterday: number;
  productionDiff: number;
  productionDiffPercent: number;
  topJob: string | null;
  topJobCount: number;
  shiftProduction: any[];
  productionByController: any[];
}

export interface MaintenanceData {
  recentMaintenance: any[];
  upcomingMaintenance: any[];
  totalMaintenanceRecords: number;
  controllersNeedingMaintenance: number;
}

export interface LogAnalysis {
  totalLogEntries: number;
  logsByController: any[];
  topEvents: { eventType: string; count: number; percentage: number }[];
  criticalEvents: any[];
  eventTypeDistribution: Record<string, number>;
  last3LogsByRobot?: any[];
}

export interface SystemSummary {
  totalRobots: number;
  onlineCount: number;
  offlineCount: number;
  avgServoTime: number;
  totalAlarmsLast24h: number;
  topPerformingRobot: string;
  mostAlarmsRobot: string;
}

export interface SystemHealthReportData {
  metadata: {
    reportId: string;
    generatedAt: string;
    dateRange: { from: string; to: string };
    totalControllers: number;
    shifts?: { name: string; start: string; end: string }[];
  };
  summary: SystemSummary;
  controllers: ControllerStatusData[];
  performance: PerformanceAnalysis;
  alarms: AlarmAnalysis;
  backups: BackupStatus;
  production: ProductionSummary;
  maintenance: MaintenanceData;
  logs: LogAnalysis;
}
