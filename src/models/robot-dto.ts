export interface RobotResponseDto {
  id: string;
  name: string;
  model: string;
  application: string;
  ipAddress: string;
  status: string;
  serialNumber: string;
  intervalMs: number;
  maxConnection: number;
  location: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export interface RobotRequestDto {
  name: string;
  model: string;
  application: string;
  ipAddress: string;
  status: string;
  serialNumber: string;
  intervalMs: number;
  maxConnection: number;
  location: string;
}
