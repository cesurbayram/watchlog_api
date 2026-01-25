import { Router } from "express";
import { createScheduledMail, sendMailHandler } from "../controllers/mail-controller";

const mailRouter = Router();

mailRouter.post("/send", sendMailHandler);
mailRouter.post("/scheduled-mail", createScheduledMail);

export default mailRouter;
