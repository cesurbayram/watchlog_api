import { Router } from "express";
import { createUser, deleteUser, updateUser } from "../controllers/user-controller";

const userRouter = Router();

userRouter.post("/", createUser);
userRouter.put("/:id", updateUser);
userRouter.delete("/:id", deleteUser);
export default userRouter;
