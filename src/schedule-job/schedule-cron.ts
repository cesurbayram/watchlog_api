import cron from "node-cron";
import { processScheduledMails } from "./job-service";

const startCronJobs = () => {
  cron.schedule("* * * * *", async () => {
    try {
      console.log("cron çalıştı");
      await processScheduledMails();
    } catch (error) {
      console.error("Cron error: ", error);
    }
  });
};

export { startCronJobs };
