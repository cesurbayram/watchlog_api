import express from "express";

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

const app = express();
const port = process.env.PORT ?? "3001";

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cell", cellRoutes);
app.use("/api/line", lineRoutes);
app.use("/api/factory", factoryRoutes);
app.use("/api/shift", shiftRoutes);
app.use("/api/robot", robotRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/general-register", generalRegisterRoutes);
app.use("/api/general-signal", generalSignalRoutes);
app.use("/api/general-variable", generalVariableRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
