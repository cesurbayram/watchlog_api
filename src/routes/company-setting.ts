import { Router } from "express";
import { createUpdateCompanySettings } from "../controllers/company-settings-controller";

const companySettingsRouter = Router()

companySettingsRouter.post('/', createUpdateCompanySettings)

export default companySettingsRouter;