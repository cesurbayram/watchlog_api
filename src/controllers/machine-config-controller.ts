import { Request, Response } from "express";
import {
  MACHINE_CONFIGURATIONS,
  getAllMachineTypes,
  getMachineNamesByType,
  getMachineConfigByName,
  MachineType,
} from "../utils/machine-config";

const getMachineTypes = async (req: Request, res: Response) => {
  try {
    const types = getAllMachineTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get machine types" });
  }
};

const getMachineNames = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    if (!type) {
      res.status(400).json({ success: false, error: "Machine type is required" });
      return;
    }
    const names = getMachineNamesByType(type as MachineType);
    res.json({ success: true, data: names });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get machine names" });
  }
};

const getMachineConfig = async (req: Request, res: Response) => {
  try {
    const { name } = req.query;
    if (!name) {
      res.status(400).json({ success: false, error: "Machine name is required" });
      return;
    }
    const config = getMachineConfigByName(name as string);
    if (!config) {
      res.status(404).json({ success: false, error: "Machine config not found" });
      return;
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get machine config" });
  }
};

const getAllMachineConfigs = async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: MACHINE_CONFIGURATIONS });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get machine configurations" });
  }
};

export { getMachineTypes, getMachineNames, getMachineConfig, getAllMachineConfigs };