import { Router } from "express";
import { getAllPages } from "../controllers/page-controller";

const pageRouter = Router();

pageRouter.get("/", getAllPages);

export default pageRouter;
