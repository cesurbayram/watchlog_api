import { Router } from "express";
import { createGeneralVariable, deleteGeneralVariable, getGeneralVariables } from "../controllers/general-variable-controller";

const generalVariableRouter = Router();

generalVariableRouter.get("/:controllerId", getGeneralVariables);
generalVariableRouter.post("/:controllerId", createGeneralVariable);
generalVariableRouter.delete("/:controllerId", deleteGeneralVariable);

export default generalVariableRouter;
