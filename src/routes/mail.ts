import { Router } from "express";
import { createScheduledMail, deleteScheduledMail, getScheduleMailData, sendMailHandler } from "../controllers/mail-controller";

const mailRouter = Router();

mailRouter.post("/send", sendMailHandler);
mailRouter.post("/scheduled-mail", createScheduledMail);
mailRouter.get("/mail-data", getScheduleMailData);
mailRouter.delete("/:id", deleteScheduledMail);

export default mailRouter;
