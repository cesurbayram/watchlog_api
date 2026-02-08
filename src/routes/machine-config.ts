import { Router } from "express";
import {
  getMachineTypes,
  getMachineNames,
  getMachineConfig,
  getAllMachineConfigs,
} from "../controllers/machine-config-controller";

const machineConfigRouter = Router();

machineConfigRouter.get("/types", getMachineTypes);
machineConfigRouter.get("/names", getMachineNames);
machineConfigRouter.get("/config", getMachineConfig);
machineConfigRouter.get("/", getAllMachineConfigs);

export default machineConfigRouter;
