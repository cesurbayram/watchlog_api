import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { sendMail } from "../services/mail-service";
import { SendMailHandlerRequestDto } from "../models/mail-dto";

const sendMailHandler = async (req: Request, res: Response) => {
  const { emailList, message, subject }: SendMailHandlerRequestDto = req.body;

  try {
    for (const email of emailList) {
      await sendMail({ email, message, subject });
    }

    return res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("An error occured while sent email" + error);
    return res.status(500).json({ message: "Failed to send email!" });
  }
};

const createScheduledMail = async (req: Request, res: Response) => {
  const { recipient, scheduleDate, message, subject } = req.body;  

  const newMailJobId = uuidv4();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    for (const email of recipient) {
      await client.query(
        `INSERT INTO scheduled_mail_jobs (id, schedule_date, mail_text, email_recipient, status, mail_subject) 
                    VALUES ($1, $2, $3, $4, $5, $6)`,
        [newMailJobId, scheduleDate, message, email, "PENDING", subject],
      );
    }
    await client.query("COMMIT");
    return res.status(201).json({ message: "Mail scheduled successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getScheduleMailData = async (req: Request, res: Response) => {
  try {
    const scheduledMailDbRes = await dbPool.query(`SELECT * FROM scheduled_mail_jobs`)
    const scheduledMailStatisticDbRes = await dbPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'SENT') as "sentCount",
        COUNT(*) FILTER (WHERE status = 'PENDING') as "pendingCount",
        COUNT(*) FILTER (WHERE status = 'FAIL') as "failCount"
      FROM scheduled_mail_jobs
    `)    

    const scheduledMailRes = {
      data: scheduledMailDbRes.rows || [],
      counts: scheduledMailStatisticDbRes.rows[0]
    }
    return res.status(200).json(scheduledMailRes); 
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({message: 'Internal Server Error'})
  }
}

export { sendMailHandler, createScheduledMail, getScheduleMailData };
