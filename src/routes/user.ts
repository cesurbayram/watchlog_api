import { Router } from "express";
import { createUser, deleteUser, getUserById, getUsers, updateUser } from "../controllers/user-controller";

const userRouter = Router();

userRouter.get("/", getUsers);
userRouter.get("/:id", getUserById);
userRouter.post("/", createUser);
userRouter.put("/:id", updateUser);
userRouter.delete("/:id", deleteUser);

export default userRouter;
