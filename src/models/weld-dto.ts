export interface WeldRawData {
  date: string;
  time: string;
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
  partVersion: string;
  jobName: string;
  seamNumber: number;
  weldLength: number;
  setVoltage: number | null;
  setCurrent: number | null;
  averageVoltage: number | null;
  averageCurrent: number | null;
  actualVoltage: number | null;
  actualCurrent: number | null;
  wireSpeed: number | null;
  torqueM1: number | null;
  torqueM2: number | null;
  averageGasFlow: number | null;
  actualGasFlow: number | null;
  gasConsumption: number | null;
  weldDuration: number | null;
  weldingSpeed: number | null;
  wireConsumption: number | null;
  machine: string;
  processTime: string | null;
  ipAddress: string;
  toolNo: number | null;
  dataPart: number | null;
  groupType: string | null;
}

export interface WeldHeaderRow {
  DataPart: string;
  Factory: string;
  Line: string;
  Cell: string;
  PartSerialID: string;
  PartItemNumber: string;
  PartVersion: string;
  SeamNumber: number;
  ToolNo: number | null;
  WeldLength: number;
  SetVoltage: number | null;
  SetCurrent: number | null;
  AvarageVoltage: number | null;
  AvarageCurrent: number | null;
  AvarageGasFlow: number | null;
  GasConsumption: number | null;
  WeldDuration: number | null;
  WeldingSpeed: number | null;
  WireConsumption: number | null;
  MachineName: string;
  IpAdress: string;
  JobName: string;
  GroupType: string | null;
}

export interface WeldDetailRow {
  Id: number;
  DataPart: string;
  DateTime: string;
  ActualVoltage: number | null;
  ActualCurrent: number | null;
  WireSpeed: number | null;
  MotorTorqueM1: number | null;
  MotorTorqueM2: number | null;
  ActualGasFlow: number | null;
}

export interface WeldFileInfo {
  fileName: string;
  date: string;
  recordCount: number;
}

export interface WeldSeamSummary {
  seamNumber: number;
  weldDuration: number | null;
  weldLength: number;
  startTime: string;
  dataPart: number | null;
  toolNo: number | null;
  groupType: string | null;
}

export interface WeldPartSummary {
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
  partVersion: string;
  jobName: string;
  machine: string;
  date: string;
  seamCount: number;
  totalRecords: number;
  seams: WeldSeamSummary[];
}

export interface FlatSeamRow {
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
  partVersion: string;
  jobName: string;
  machine: string;
  date: string;
  seamNumber: number;
  startTime: string;
  weldDuration: number | null;
  weldLength: number;
  dataPart: number | null;
  toolNo: number | null;
  groupType: string | null;
}

export interface WeldSeamDetail {
  seamNumber: number;
  operationIndex: number;
  startTime: string;
  weldLength: number;
  weldDuration: number | null;
  weldingSpeed: number | null;
  wireConsumption: number | null;
  setVoltage: number | null;
  setCurrent: number | null;
  averageVoltage: number | null;
  averageCurrent: number | null;
  averageGasFlow: number | null;
  gasConsumption: number | null;
  recordCount: number;
  dataPart: number | null;
  toolNo: number | null;
}

export interface WeldActualData {
  date: string;
  time: string;
  actualVoltage: number | null;
  actualCurrent: number | null;
  wireSpeed: number | null;
  torqueM1: number | null;
  torqueM2: number | null;
  actualGasFlow: number | null;
}
