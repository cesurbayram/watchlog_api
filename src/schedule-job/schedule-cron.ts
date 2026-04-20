import cron from "node-cron";
import { processScheduledMails } from "./job-service";
import { processDataFetchSchedule } from "./data-fetch-scheduler";

const startCronJobs = () => {
  cron.schedule("* * * * *", async () => {
    try {
      await processScheduledMails();
    } catch (error) {
      console.error("Cron error (mail): ", error);
    }
  });

  cron.schedule("* * * * *", async () => {
    try {
      await processDataFetchSchedule();
    } catch (error) {
      console.error("Cron error (data-fetch): ", error);
    }
  });
};

export { startCronJobs };
