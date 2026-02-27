import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { broadcastAndInsertNotification } from "../utils/notification";

const getNotifications = async (req: Request, res: Response) => {
  const { user_id } = req.query;

  try {
    let query = `
          SELECT id, type, title, message, data, user_id, is_read, created_at, updated_at, notification_id
          FROM notifications WHERE user_id = $1 ORDER BY created_at DESC 
         
        `;

    const notificationDbRes = await dbPool.query(query, [user_id]);
    const notifications = notificationDbRes.rows;

    const response = {
      notifications,
      unread_count: 0,
      total_count: notifications.length,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

const createNotification = async (req: Request, res: Response) => {
  const { type, title, message, data } = req.body;

  if (!type || !title || !message) {
    return res.status(400).json({ error: "Missing required fields: type, title, message" });
  }

  try {
    const newNotification = await broadcastAndInsertNotification({ data, message, title, type });
    return res.status(201).json(newNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ error: "Failed to create notification" });
  }
};

const deleteAllNotifications = async (req: Request, res: Response) => {
  const { userId } = req.params;

  const client = await dbPool.connect();
  try {
    const result = await client.query("DELETE FROM notifications WHERE user_id = $1", [userId]);

    return res.status(200).json({
      success: true,
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    return res.status(500).json({ error: "Failed to delete all notifications" });
  } finally {
    client.release();
  }
};

const markReadAllNotifications = async (req: Request, res: Response) => {
  const { notification_ids, user_id } = req.body;

  const client = await dbPool.connect();

  try {
    let query = `UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE notification_id = ANY($1) AND user_id = $2`;

    const result = await client.query(query, [notification_ids, user_id]);

    return res.status(200).json({
      message: "Notifications marked as read",
      updated_count: result.rowCount,
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  } finally {
    client.release();
  }
};

const deleteNotificationById = async (req: Request, res: Response) => {
  const { notificationId, userId } = req.params;

  if (!notificationId) {
    return res.status(400).json({ error: "ID is required" });
  }

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2", [notificationId, userId]);
    await client.query("COMMIT");

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("DELETE notification error:", error);
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to delete notification" });
  } finally {
    client.release();
  }
};

export { getNotifications, createNotification, deleteAllNotifications, markReadAllNotifications, deleteNotificationById };
