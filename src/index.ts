import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import cellRoutes from "./routes/cell.js";
import lineRoutes from "./routes/line.js";
import factoryRoutes from "./routes/factory.js";
import shiftRoutes from "./routes/shift.js";
import robotRoutes from "./routes/robot.js";
import notificationRoutes from "./routes/notification.js";
import generalRegisterRoutes from "./routes/general-register.js";
import generalSignalRoutes from "./routes/general-signal.js";
import generalVariableRoutes from "./routes/general-variable.js";
import dashboardRoutes from "./routes/dashboard.js";
import jobRoutes from "./routes/job.js";
import shiftMaintenanceRoutes from "./routes/shift-maintenance.js";
import systemInfoRoutes from "./routes/system-info.js";
import systemExpectationRoutes from "./routes/system-expectation.js";
import arcFunctionRoutes from "./routes/arc-function.js";
import cameraRoutes from "./routes/camera.js";
import homeRoutes from "./routes/home.js";
import productionTrackingRoutes from "./routes/production-tracking.js";
import quickAssistRoutes from "./routes/quick-assist.js";
import systemReportsRoutes from "./routes/system-reports.js";
import weldRoutes from "./routes/weld.js";
import auth from "./middleware/auth-middleware.js";
import mailRoutes from "./routes/mail.js";
import { startCronJobs } from "./schedule-job/schedule-cron.js";

const app = express();
const port = process.env.PORT ?? "3001";

app.use(express.json());
app.use(cors());

app.use("/api-v2/auth", authRoutes);
app.use("/api-v2/notification", notificationRoutes);

app.use(auth);
app.use("/api-v2/user", userRoutes);
app.use("/api-v2/cell", cellRoutes);
app.use("/api-v2/line", lineRoutes);
app.use("/api-v2/factory", factoryRoutes);
app.use("/api-v2/shift", shiftRoutes);
app.use("/api-v2/robot", robotRoutes);
app.use("/api-v2/general-register", generalRegisterRoutes);
app.use("/api-v2/general-signal", generalSignalRoutes);
app.use("/api-v2/general-variable", generalVariableRoutes);
app.use("/api-v2/dashboard", dashboardRoutes);
app.use("/api-v2/job", jobRoutes);
app.use("/api-v2/shift-maintenance", shiftMaintenanceRoutes);
app.use("/api-v2/system-info", systemInfoRoutes);
app.use("/api-v2/system-expectations", systemExpectationRoutes);
app.use("/api-v2/arc-function", arcFunctionRoutes);
app.use("/api-v2/camera", cameraRoutes);
app.use("/api-v2/home", homeRoutes);
app.use("/api-v2/production-tracking", productionTrackingRoutes);
app.use("/api-v2/quick-assist", quickAssistRoutes);
app.use("/api-v2/system-reports", systemReportsRoutes);
app.use("/api-v2/weld", weldRoutes);
app.use("/api-v2/mail", mailRoutes);

startCronJobs();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
