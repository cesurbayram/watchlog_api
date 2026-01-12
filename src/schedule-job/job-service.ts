import { dbPool } from "../config/db";
import dayjs from "dayjs";
import { sendMail } from "../services/mail-service";

export const processScheduledMails = async () => {
  const formattedDate = dayjs().format("YYYY-MM-DD HH:mm:ss");

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const mailToBeSendDbRes = await client.query(
      `
            SELECT * FROM scheduled_mail_jobs smj WHERE smj.status='PENDING'
                                        AND smj.schedule_date <= $1
        `,
      [formattedDate],
    );

    const mailToBeSendData = mailToBeSendDbRes.rows;

    for (const item of mailToBeSendData) {
      await sendMail({
        email: item?.email_recipient,
        message: item?.mail_text,
      });

      await client.query(
        `
            UPDATE scheduled_mail_jobs SET status = 'SENT' WHERE id=$1  
        `,
        [item?.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mail process error:", error);
  } finally {
    client.release();
  }
};
