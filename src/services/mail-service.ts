import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.FROM_PASSWORD,
  },
});

interface SendMailProps {
  email: string;
  message: string;
  subject: string;
}

export const sendMail = async ({ email, message, subject }: SendMailProps): Promise<void> => {
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: subject,
    text: message,
    replyTo: email,
  });
};
