import { Router } from "express";
import { getSystemInfoByControllerId } from "../controllers/system-info-controller";

const systemInfoRouter = Router();

systemInfoRouter.get("/read-file/:controllerId", getSystemInfoByControllerId);

export default systemInfoRouter;
