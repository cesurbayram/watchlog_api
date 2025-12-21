import { Router } from "express";
import {
  createNotification,
  deleteAllNotifications,
  deleteNotificationById,
  getNotifications,
  markReadAllNotifications,
} from "../controllers/notification-controller";

const notificationRouter = Router();

notificationRouter.get("/", getNotifications);
notificationRouter.post("/", createNotification);
notificationRouter.post("/mark-read-all-notifications", markReadAllNotifications);
notificationRouter.delete("/:id", deleteNotificationById);
notificationRouter.delete("/", deleteAllNotifications);

export default notificationRouter;
