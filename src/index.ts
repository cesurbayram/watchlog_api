import express from "express";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";

const app = express();
const port = process.env.PORT ?? "3001";

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
