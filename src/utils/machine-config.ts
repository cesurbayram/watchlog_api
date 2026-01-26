export type MachineType = "FRONIUS" | "ESAB" | "SKS";

export interface MachineRegisterMapping {
  machineName: string;
  machineType: MachineType;
  registers: {
    setVoltage?: number[];
    setCurrent?: number[];
    actualVoltage?: number[];
    actualCurrent?: number[];
    wireSpeed?: number[];
    motorTorqueM1?: number[];
    motorTorqueM2?: number[];
    actualGasFlow?: number[];
  };
}

export const MACHINE_CONFIGURATIONS: MachineRegisterMapping[] = [
  {
    machineName: "ESAB-ARISTO-EDGE",
    machineType: "ESAB",
    registers: {
      actualVoltage: [183],
      actualCurrent: [184],
    },
  },

  {
    machineName: "FRONIUS-TPS-500i",
    machineType: "FRONIUS",
    registers: {
      actualVoltage: [152],
      actualCurrent: [153],
      wireSpeed: [151],
    },
  },
  {
    machineName: "SKS-SYNCROWELD",
    machineType: "SKS",
    registers: {
      actualVoltage: [182, 186, 190],
      actualCurrent: [183, 187, 191],
    },
  },
];

export const getMachineNamesByType = (machineType: MachineType): string[] => {
  return MACHINE_CONFIGURATIONS.filter(
    (config) => config.machineType === machineType
  ).map((config) => config.machineName);
};

export const getMachineConfigByName = (
  machineName: string
): MachineRegisterMapping | undefined => {
  return MACHINE_CONFIGURATIONS.find(
    (config) => config.machineName === machineName
  );
};

export const getAllMachineTypes = (): MachineType[] => {
  return [
    ...new Set(MACHINE_CONFIGURATIONS.map((config) => config.machineType)),
  ];
};