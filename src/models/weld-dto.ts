export interface WeldRawData {
  dataPart: string;
  date: string;
  time: string;
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
  jobName: string;
  seamNumber: number;
  weldLength: number;
  setVoltage: number;
  setCurrent: number;
  averageVoltage: number;
  averageCurrent: number;
  averageGasFlow: number;
  averageWireSpeed: number;
  averageMotorTorqueM1: number;
  averageMotorTorqueM2: number;
  actualVoltage: number;
  actualCurrent: number;
  actualWireSpeed: number;
  torqueM1: number;
  torqueM2: number;
  actualGasFlow: number;
  weldDuration: number;
  weldingSpeed: number;
  wireConsumption: number;
  machine: string;
  ipAddress: string;
  toolNo: number;
  groupType: string;
}

export interface WeldSeamSummary {
  seamNumber: number;
  weldDuration: number;
  weldLength: number;
  startTime: string;
  dataPart: string;
  toolNo: number;
  groupType: string;
}

export interface WeldPartSummary {
  factory: string;
  line: string;
  cell: string;
  partSerialId: string;
  partItemNumber: string;
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
  jobName: string;
  machine: string;
  date: string;
  seamNumber: number;
  startTime: string;
  weldDuration: number;
  weldLength: number;
  dataPart: string;
  toolNo: number;
  groupType: string;
}

export interface WeldSeamDetail {
  seamNumber: number;
  operationIndex: number;
  startTime: string;
  weldLength: number;
  weldDuration: number;
  weldingSpeed: number;
  wireConsumption: number;
  setVoltage: number;
  setCurrent: number;
  averageVoltage: number;
  averageCurrent: number;
  averageGasFlow: number;
  averageWireSpeed: number;
  averageMotorTorqueM1: number;
  averageMotorTorqueM2: number;
  recordCount: number;
  dataPart: string;
  toolNo: number;
}

export interface WeldActualData {
  date: string;
  time: string;
  actualVoltage: number;
  actualCurrent: number;
  actualWireSpeed: number;
  torqueM1: number;
  torqueM2: number;
  actualGasFlow: number;
}
