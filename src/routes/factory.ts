import { Router } from "express";
import { createFactory, deleteFactory, getFactories, getFactoryById, updateFactory } from "../controllers/factory-controller";

const factoryRouter = Router();

factoryRouter.get("/", getFactories);
factoryRouter.get("/:id", getFactoryById);
factoryRouter.post("/", createFactory);
factoryRouter.put("/:id", updateFactory);
factoryRouter.delete("/:id", deleteFactory);

export default factoryRouter;
