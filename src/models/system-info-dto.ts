export interface RobotInfo {
  name: string;
  model: string;
  servoPowerTime?: string;
  playbackTime?: string;
  movingTime?: string;
}

export interface PositionerInfo {
  name: string;
  model: string;
  servoPowerTime?: string;
  playbackTime?: string;
  movingTime?: string;
}

export interface ParsedSystemInfo {
  systemNo?: string;
  version?: string;
  paramNo?: string;
  application?: string;
  language?: string;
  robotModel?: string;
  robotName?: string;
  robots: RobotInfo[];
  positioners: PositionerInfo[];
}
