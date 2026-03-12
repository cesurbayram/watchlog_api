import cron from "node-cron";
import { processScheduledMails } from "./job-service";

const startCronJobs = () => {
  cron.schedule("* * * * *", async () => {
    try {
      await processScheduledMails();
    } catch (error) {
      console.error("Cron error (mail): ", error);
    }
  });
};

export { startCronJobs };
