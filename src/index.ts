import express from "express";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import cellRoutes from "./routes/cell.js";
import lineRoutes from "./routes/line.js";
import factoryRoutes from "./routes/factory.js";

const app = express();
const port = process.env.PORT ?? "3001";

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cell", cellRoutes);
app.use("/api/line", lineRoutes);
app.use("/api/factory", factoryRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
