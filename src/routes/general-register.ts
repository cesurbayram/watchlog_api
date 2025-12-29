import { Router } from "express";
import { createGeneralRegister, deleteGeneralRegister, getGeneralRegisters } from "../controllers/general-register-controller";

const generalRegisterRouter = Router();

generalRegisterRouter.get("/:controllerId", getGeneralRegisters);
generalRegisterRouter.post("/:controllerId", createGeneralRegister);
generalRegisterRouter.delete("/:controllerId", deleteGeneralRegister);

export default generalRegisterRouter;
