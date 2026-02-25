import nodemailer from "nodemailer";
import { dbPool } from "../config/db";
import { z } from "zod";

interface TransporterConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
}

interface SendMailProps {
  email: string;
  message: string;
  subject: string;
}

const smtpConfigSchema = z.object({
  smtp_host: z.string().min(1, "SMTP host bilgisi eksik"),
  smtp_port: z.string().min(1, "SMTP Port geçersiz"),
  smtp_user: z.string().email("Geçersiz SMTP kullanıcı e-postası"),
  smtp_password: z.string().min(1, "SMTP şifresi geçersiz"),
});

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

export const sendMail = async ({ email, message, subject }: SendMailProps): Promise<void> => {
  const smtpConfigDbRes = await dbPool.query<TransporterConfig>(`SELECT smtp_host, smtp_port, smtp_user, smtp_password FROM company`);

  const smtpConfigData = smtpConfigDbRes.rows[0];

  const validateData = smtpConfigSchema.parse(smtpConfigData);

  const transporter = createDynamicTransporter(validateData);

  await transporter.sendMail({
    from: smtpConfigData.smtp_user,
    to: email,
    subject: subject,
    text: message,
    replyTo: email,
  });
};
