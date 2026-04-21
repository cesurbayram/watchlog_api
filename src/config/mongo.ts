import mongoose from "mongoose";
import { ON_PREM_MONGO_URI } from "./on-prem-config";

const MONGO_URI = ON_PREM_MONGO_URI;

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

export default mongoose;
