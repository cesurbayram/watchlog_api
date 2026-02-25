import { Router } from "express";
import { getAllPages, getPermittedPages } from "../controllers/page-controller";

const pageRouter = Router();

pageRouter.get("/", getAllPages);
pageRouter.get("/:id/user-access", getPermittedPages);

export default pageRouter;
