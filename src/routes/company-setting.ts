import { Router } from "express";
import { createUpdateCompanySettings, getCompanySettings } from "../controllers/company-settings-controller";

const companySettingsRouter = Router()

companySettingsRouter.post('/', createUpdateCompanySettings);
companySettingsRouter.get('/', getCompanySettings);

export default companySettingsRouter;