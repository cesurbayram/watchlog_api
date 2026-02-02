import { Router } from "express";
import { createScheduledMail, getScheduleMailData, sendMailHandler } from "../controllers/mail-controller";

const mailRouter = Router();

mailRouter.post("/send", sendMailHandler);
mailRouter.post("/scheduled-mail", createScheduledMail);
mailRouter.get("/mail-data", getScheduleMailData);

export default mailRouter;
