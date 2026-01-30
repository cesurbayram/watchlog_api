import { RobotMaintenanceIntervals } from "../models/maintenace-dto";

const DEFAULT_INTERVALS: RobotMaintenanceIntervals = {
  periodicMaintenance: 6000,
  internalCable: 24000,
  overhaul: 36000,
  belt: "yok",
  gasBalancer: "yok",
};

const DX200_INTERVALS: Record<string, RobotMaintenanceIntervals> = {
  MA1440: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  MH225: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  MH12: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  MH180: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  MS210: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  MS165: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  MH5: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "MH50-J00": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "MH50-J10": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "MH50-J30": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  MS80: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  MS100: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  ES200RD: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  MPL80: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  MH24: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  MA2010: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  MPX3500: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
};

const YRC1000_INTERVALS: Record<string, RobotMaintenanceIntervals> = {
  GP8: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  GP165R: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP165R-A0B": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP165R-A0C": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  GP200R: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  SP185R: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  GP300R: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  GP400R: { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP400R-A10": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP120RL-120": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP120RL-120-A0C": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP215-200T": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  "GP215-200T-A20": { periodicMaintenance: 6000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  GP4: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP4-F00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP7/AR900": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP7/AR900-A00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP7/AR900-B00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP8/AR700": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP8/AR700-A00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  "GP8/AR700-B00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  GP10: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  GP20: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
  GP50: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP88-A00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "SP80-A00": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  GP110: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "GP180-120": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  "SP165-105": { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  GP215: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  GP225: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "yok", gasBalancer: "var" },
  PL190: { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  PL320: { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "PL190-A00": { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  "PL190-B00": { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  PL500: { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  PL800: { periodicMaintenance: 9000, internalCable: 18000, overhaul: 36000, belt: "yok", gasBalancer: "yok" },
  SG400: { periodicMaintenance: 6000, internalCable: "yok", overhaul: 20000, belt: "yok", gasBalancer: "yok" },
  SG650: { periodicMaintenance: 6000, internalCable: "yok", overhaul: 20000, belt: "yok", gasBalancer: "yok" },
  PL80: { periodicMaintenance: 12000, internalCable: 24000, overhaul: 36000, belt: "var", gasBalancer: "yok" },
};

export function getMaintenanceIntervals(
  robotModel: string | null | undefined,
  controllerModel: string | null | undefined,
): RobotMaintenanceIntervals {
  if (!robotModel) {
    return DEFAULT_INTERVALS;
  }

  let extractedModel = robotModel;
  const parenMatch = robotModel.match(/\(([^)]+)\)/);
  if (parenMatch) {
    extractedModel = parenMatch[1];
  }

  const controllerModelLower = (controllerModel || "").toLowerCase();

  if (controllerModelLower.includes("yrc1000")) {
    if (YRC1000_INTERVALS[extractedModel]) {
      return YRC1000_INTERVALS[extractedModel];
    }
  } else if (controllerModelLower.includes("dx200")) {
    if (DX200_INTERVALS[extractedModel]) {
      return DX200_INTERVALS[extractedModel];
    }
  }

  if (YRC1000_INTERVALS[extractedModel]) {
    return YRC1000_INTERVALS[extractedModel];
  }
  if (DX200_INTERVALS[extractedModel]) {
    return DX200_INTERVALS[extractedModel];
  }

  return DEFAULT_INTERVALS;
}
