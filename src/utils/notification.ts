import { dbPool } from "../config/db.js";
import { ON_PREM_NOTIFICATION_SERVER_URL } from "../config/on-prem-config.js";
import { v4 as uuidv4 } from "uuid";

export const broadcastAndInsertNotification = async ({ type, title, message, data }: any) => {
  const client = await dbPool.connect();
  const newNotificationId = uuidv4();

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
            RETURNING id, user_id, type, title, message, data, is_read, created_at, notification_id;
            `,
      [type, title, message, data || null, newNotificationId],
    );

    await client.query("COMMIT");

    const newNotification = result.rows[0];

    try {
      await fetch(`${ON_PREM_NOTIFICATION_SERVER_URL}/notify`, {
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
