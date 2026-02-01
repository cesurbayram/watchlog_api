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
notificationRouter.delete("/:notificationId/:userId", deleteNotificationById);
notificationRouter.delete("/:userId", deleteAllNotifications);

export default notificationRouter;
