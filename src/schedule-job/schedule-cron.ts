import cron from "node-cron";
import { processScheduledMails } from "./job-service";
import { processDataFetchSchedule } from "./data-fetch-scheduler";
import { runWatchedJobsFetch } from "../services/job-watch-fetch.service";

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

  cron.schedule("*/5 * * * *", async () => {
    try {
      const r = await runWatchedJobsFetch();
      if (r.fetched > 0 || r.failed > 0) {
        console.log(`[JobWatch] polled watched jobs: ok=${r.fetched} fail=${r.failed}`);
      }
    } catch (error) {
      console.error("Cron error (job-watch): ", error);
    }
  });
};

export { startCronJobs };
