import nodemailer from "nodemailer";
import { dbPool } from "../config/db";

interface TransporterConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
}

const createDynamicTransporter = ({ smtp_host, smtp_port, smtp_user, smtp_password }: TransporterConfig) => {
  return nodemailer.createTransport({
    // host: "smtp.gmail.com",
    // port: 587,
    // secure: true,
    // auth: {
    //   user: process.env.FROM_EMAIL,
    //   pass: process.env.FROM_PASSWORD,
    // },
    host: smtp_host,
    port: smtp_port,
    //secure: true,
    auth: {
      user: smtp_user,
      pass: smtp_password,
    },
  });
};
interface SendMailProps {
  email: string;
  message: string;
  subject: string;
}

export const sendMail = async ({ email, message, subject }: SendMailProps): Promise<void> => {
  const smtpConfigDbRes = await dbPool.query<TransporterConfig>(`SELECT smtp_host, smtp_port, smtp_user, smtp_password FROM company`);

  const smtpConfigData = smtpConfigDbRes.rows[0];

  const transporter = createDynamicTransporter(smtpConfigData);

  await transporter.sendMail({
    from: smtpConfigData.smtp_user,
    to: email,
    subject: subject,
    text: message,
    replyTo: email,
  });
};
