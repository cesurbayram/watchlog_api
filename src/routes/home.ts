import { Router } from "express";
import { getHierarchy } from "../controllers/home-controller";

const homeRouter = Router();

homeRouter.get("/hierarchy", getHierarchy);

export default homeRouter;
