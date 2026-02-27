import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

export const broadcastAndInsertNotification = async ({ type, title, message, data }: any) => {
  const client = await dbPool.connect();
  const newNotificationId = uuidv4();
  const controllerId = data?.controllerId || null;

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
            INSERT INTO notifications (
              id,
              type,
              title,
              message,
              data,
              user_id,
              is_read,
              notification_id
            )
            SELECT
              gen_random_uuid(),
              $1,
              $2,
              $3,
              $4,
              u.id,
              false,
              $5
            FROM users u
            WHERE ($6::text IS NULL) OR
            (u.id IN (SELECT user_id FROM controller_user_permission WHERE controller_id = $6))
            RETURNING id, user_id, type, title, message, data, is_read, created_at, notification_id;
            `,
      [type, title, message, data || null, newNotificationId, controllerId],
    );

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      console.log("Bildirim gönderilecek yetkili kullanıcı bulunamadı.");
      return null;
    }

    const newNotification = result.rows[0];

    try {
      await fetch(`${process.env.NOTIFICATION_SERVER_URL}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newNotification),
      });
    } catch (error) {
      console.error("Error sending notification to notification server:", error);
      throw error;
    }
    return newNotification;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating notification:", error);
    throw error;
  } finally {
    client.release();
  }
};
