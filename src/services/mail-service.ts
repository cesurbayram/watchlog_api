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
}

export const sendMail = async ({ email, message }: SendMailProps): Promise<void> => {
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "New message for test",
    text: message,
    replyTo: email,
  });
};
