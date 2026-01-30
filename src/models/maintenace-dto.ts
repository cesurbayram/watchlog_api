export interface RobotMaintenanceIntervals {
  periodicMaintenance: number;
  internalCable: number | "yok";
  overhaul: number;
  belt: "var" | "yok";
  gasBalancer: "var" | "yok";
}
