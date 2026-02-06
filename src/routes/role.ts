import { Router } from "express";
import { createRole, deleteRole, getRoleById, getRoles, updateRole } from "../controllers/role-controller";

const roleRouter = Router();

roleRouter.get("/", getRoles);
roleRouter.get("/:id", getRoleById);
roleRouter.post("/", createRole);
roleRouter.put("/:id", updateRole);
roleRouter.delete("/:id", deleteRole);

export default roleRouter;
