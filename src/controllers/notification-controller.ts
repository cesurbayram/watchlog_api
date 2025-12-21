import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

const getNotifications = async (req: Request, res: Response) => {
  try {
    let query = `
          SELECT id, type, title, message, data, user_id, is_read, created_at, updated_at
          FROM notifications ORDER BY created_at DESC
         
        `;

    const notificationDbRes = await dbPool.query(query);
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
  const { type, title, message, data, user_id } = req.body;

  if (type || title || message) {
    return res.status(400).json({ error: "Missing required fields: type, title, message" });
  }

  const notificationId = uuidv4();

  const client = await dbPool.connect();

  try {
    const result = await client.query(
      `INSERT INTO notifications (id, type, title, message, data, user_id, is_read) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [notificationId, type, title, message, data || null, user_id || null, false],
    );

    const newNotification = result.rows[0];

    // try {
    //   await fetch(`${process.env.NOTIFICATION_SERVER_URL}/notify`, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify(newNotification),
    //   });
    // } catch (error) {
    //   console.error(
    //     "Error sending notification to notification server:",
    //     error
    //   );
    // }

    return res.status(201).json(newNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ error: "Failed to create notification" });
  } finally {
    client.release();
  }
};

const deleteAllNotifications = async (req: Request, res: Response) => {
  const client = await dbPool.connect();
  try {
    const result = await client.query("DELETE FROM notifications");

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
  const { notification_ids } = req.body;

  const client = await dbPool.connect();

  try {
    let query = `UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE `;
    let params = [];

    if (notification_ids && notification_ids.length > 0) {
      query += `id = ANY($1)`;
      params.push(notification_ids);
    }

    const result = await client.query(query, params);

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
  const notificationId = req.params?.id;

  if (!notificationId) {
    return res.status(400).json({ error: "ID is required" });
  }

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM notifications WHERE id = $1", [notificationId]);
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
