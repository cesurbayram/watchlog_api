import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { SEC100CameraService } from "../utils/sec100-camera-service";

const getCameras = async (req: Request, res: Response) => {
  try {
    const { controllerId } = req.query;

    let query = `
      SELECT 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        ws_port as "wsPort",
        active,
        record_on_alarm as "recordOnAlarm",
        record_on_error as "recordOnError",
        record_on_stop as "recordOnStop",
        record_on_door_opened as "recordOnDoorOpened",
        event_time_before_trigger as "eventTimeBeforeTrigger",
        event_time_after_trigger as "eventTimeAfterTrigger",
        created_at as "createdAt"
      FROM camera
      WHERE 1=1
    `;

    const params: any[] = [];

    if (controllerId) {
      query += ` AND controller_id = $1`;
      params.push(controllerId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await dbPool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCameraById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `SELECT 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        ws_port as "wsPort",
        active,
        record_on_alarm as "recordOnAlarm",
        record_on_error as "recordOnError",
        record_on_stop as "recordOnStop",
        record_on_door_opened as "recordOnDoorOpened",
        event_time_before_trigger as "eventTimeBeforeTrigger",
        event_time_after_trigger as "eventTimeAfterTrigger",
        created_at as "createdAt"
      FROM camera
      WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const createCamera = async (req: Request, res: Response) => {
  try {
    const {
      controllerId,
      title,
      ipAddress,
      username,
      password,
      wsPort = 8888,
      active = true,
      recordOnAlarm = true,
      recordOnError = false,
      recordOnStop = false,
      recordOnDoorOpened = false,
      eventTimeBeforeTrigger = 5,
      eventTimeAfterTrigger = 5,
    } = req.body;

    if (!controllerId || !title || !ipAddress) {
      return res.status(400).json({
        message: "Missing required fields: controllerId, title, ipAddress",
      });
    }

    const result = await dbPool.query(
      `INSERT INTO camera (
        controller_id, title, ip_address, username, password, 
        ws_port, active, record_on_alarm, record_on_error, record_on_stop,
        record_on_door_opened, event_time_before_trigger, event_time_after_trigger
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        ws_port as "wsPort",
        active,
        record_on_alarm as "recordOnAlarm",
        record_on_error as "recordOnError",
        record_on_stop as "recordOnStop",
        record_on_door_opened as "recordOnDoorOpened",
        event_time_before_trigger as "eventTimeBeforeTrigger",
        event_time_after_trigger as "eventTimeAfterTrigger",
        created_at as "createdAt"`,
      [
        controllerId,
        title,
        ipAddress,
        username,
        password,
        wsPort,
        active,
        recordOnAlarm,
        recordOnError,
        recordOnStop,
        recordOnDoorOpened,
        eventTimeBeforeTrigger,
        eventTimeAfterTrigger,
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateCamera = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      ipAddress,
      username,
      password,
      wsPort,
      active,
      recordOnAlarm,
      recordOnError,
      recordOnStop,
      recordOnDoorOpened,
      eventTimeBeforeTrigger,
      eventTimeAfterTrigger,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (ipAddress !== undefined) {
      updates.push(`ip_address = $${paramIndex++}`);
      values.push(ipAddress);
    }
    if (username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }
    if (password !== undefined) {
      updates.push(`password = $${paramIndex++}`);
      values.push(password);
    }
    if (wsPort !== undefined) {
      updates.push(`ws_port = $${paramIndex++}`);
      values.push(wsPort);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(active);
    }
    if (recordOnAlarm !== undefined) {
      updates.push(`record_on_alarm = $${paramIndex++}`);
      values.push(recordOnAlarm);
    }
    if (recordOnError !== undefined) {
      updates.push(`record_on_error = $${paramIndex++}`);
      values.push(recordOnError);
    }
    if (recordOnStop !== undefined) {
      updates.push(`record_on_stop = $${paramIndex++}`);
      values.push(recordOnStop);
    }
    if (recordOnDoorOpened !== undefined) {
      updates.push(`record_on_door_opened = $${paramIndex++}`);
      values.push(recordOnDoorOpened);
    }
    if (eventTimeBeforeTrigger !== undefined) {
      updates.push(`event_time_before_trigger = $${paramIndex++}`);
      values.push(eventTimeBeforeTrigger);
    }
    if (eventTimeAfterTrigger !== undefined) {
      updates.push(`event_time_after_trigger = $${paramIndex++}`);
      values.push(eventTimeAfterTrigger);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(id);

    const query = `
      UPDATE camera 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort",
        active,
        record_on_alarm as "recordOnAlarm",
        record_on_error as "recordOnError",
        record_on_stop as "recordOnStop",
        record_on_door_opened as "recordOnDoorOpened",
        event_time_before_trigger as "eventTimeBeforeTrigger",
        event_time_after_trigger as "eventTimeAfterTrigger",
        created_at as "createdAt"
    `;

    const result = await dbPool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteCamera = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(`DELETE FROM camera WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found" });
    }

    return res.status(200).json({ message: "Camera deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const triggerByController = async (req: Request, res: Response) => {
  try {
    const { controllerId, triggerType = "alarm" } = req.body;

    if (!controllerId) {
      return res.status(400).json({ message: "controllerId is required" });
    }

    let recordColumn: string;
    switch (triggerType) {
      case "error":
        recordColumn = "record_on_error";
        break;
      case "stop":
        recordColumn = "record_on_stop";
        break;
      case "door_opened":
        recordColumn = "record_on_door_opened";
        break;
      case "alarm":
      default:
        recordColumn = "record_on_alarm";
        break;
    }

    const camerasResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        ws_port as "wsPort"
      FROM camera
      WHERE controller_id = $1
        AND active = true
        AND ${recordColumn} = true`,
      [controllerId],
    );

    const cameras = camerasResult.rows;

    if (cameras.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No active cameras with ${recordColumn} enabled`,
        triggered: 0,
      });
    }

    const cameraPromises = cameras.map(async (camera: any) => {
      try {
        const sec100Service = new SEC100CameraService({
          ipAddress: camera.ipAddress,
          wsPort: camera.wsPort,
          timeout: 10000,
        });

        const eventResult = await sec100Service.triggerEventRecording();

        if (eventResult.success) {
          return {
            success: true,
            cameraId: camera.id,
            cameraTitle: camera.title,
          };
        } else {
          console.error(`[Camera API] Event recording failed for ${camera.title}:`, eventResult.message);
          return {
            success: false,
            cameraId: camera.id,
            cameraTitle: camera.title,
            error: eventResult.message,
          };
        }
      } catch (error: any) {
        console.error(`[Camera API] Event recording error for ${camera.title}:`, error.message);
        return {
          success: false,
          cameraId: camera.id,
          cameraTitle: camera.title,
          error: error.message,
        };
      }
    });

    const results = await Promise.allSettled(cameraPromises);

    const successfulRecordings = results.filter((r) => r.status === "fulfilled" && r.value.success).length;

    return res.status(200).json({
      success: true,
      message: "Camera event recordings triggered",
      total: cameras.length,
      successful: successfulRecordings,
      failed: cameras.length - successfulRecordings,
      results: results.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason })),
    });
  } catch (error: any) {
    console.error("[Camera API] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to trigger cameras",
      error: error.message,
    });
  }
};

const triggerSnapshot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 10000,
    });

    const result = await sec100Service.triggerSnapshot();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        result: result.result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Snapshot triggered successfully",
      camera: {
        id: camera.id,
        title: camera.title,
        ipAddress: camera.ipAddress,
      },
      result: result.result,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to trigger snapshot",
      error: error.message,
    });
  }
};

const getLiveImage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 10000,
    });

    const imageBuffer = await sec100Service.captureLiveImage();

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": imageBuffer.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Camera-Id": camera.id,
      "X-Camera-Title": camera.title,
    });

    return res.status(200).send(imageBuffer);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to capture live image",
      error: error.message,
    });
  }
};

const getEventList = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 10000,
    });

    const eventList = await sec100Service.getEventList();

    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).json({
      success: true,
      data: eventList,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to get event list: ${error.message}`,
      error: error.message,
    });
  }
};

const triggerEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        controller_id as "controllerId",
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 10000,
    });

    const result = await sec100Service.triggerEventRecording();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        result: result.result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event recording triggered successfully",
      camera: {
        id: camera.id,
        title: camera.title,
        ipAddress: camera.ipAddress,
      },
      result: result.result,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to trigger event recording",
      error: error.message,
    });
  }
};

// POST /camera/:id/update-trigger-settings
const updateTriggerSettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { eventTimeBeforeTrigger, eventTimeAfterTrigger } = req.body;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    if (!camera.username || !camera.password) {
      return res.status(400).json({ message: "Camera credentials not configured" });
    }

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 15000,
    });

    sec100Service.setCredentials(camera.username, camera.password);

    const result = await sec100Service.updateEventRecordingSettings(eventTimeBeforeTrigger, eventTimeAfterTrigger);

    return res.status(200).json({
      success: result.success,
      message: result.message,
      camera: {
        id: camera.id,
        title: camera.title,
        ipAddress: camera.ipAddress,
      },
      settings: {
        eventTimeBeforeTrigger,
        eventTimeAfterTrigger,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to update camera trigger settings",
      error: error.message,
    });
  }
};

// POST /camera/:id/download-snapshot
const downloadSnapshot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found" });
    }

    const camera = cameraResult.rows[0];

    if (!camera.username || !camera.password) {
      return res.status(400).json({ message: "Camera credentials not configured" });
    }

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 15000,
    });

    sec100Service.setCredentials(camera.username, camera.password);

    const imageBuffer = await sec100Service.downloadFile("latestSnapshot");

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="snapshot-${Date.now()}.jpg"`,
    });

    return res.status(200).send(Buffer.from(imageBuffer));
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to download snapshot",
      error: error.message,
    });
  }
};

const downloadFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ message: "Filename is required" });
    }

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        username,
        password
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    if (!camera.username || !camera.password) {
      return res.status(400).json({
        message: "Camera username or password not configured for authenticated download.",
      });
    }

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      timeout: 30000,
    });

    sec100Service.setCredentials(camera.username, camera.password);

    const fileBuffer = await sec100Service.downloadFile(filename);

    const ext = filename.toLowerCase().split(".").pop();
    let contentType = "application/octet-stream";
    if (ext === "mp4") contentType = "video/mp4";
    else if (ext === "jpeg" || ext === "jpg") contentType = "image/jpeg";
    else if (ext === "bmp") contentType = "image/bmp";

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    return res.status(200).send(Buffer.from(fileBuffer));
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to download file: ${error.message}`,
      error: error.message,
    });
  }
};

const downloadEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        username,
        password,
        ws_port as "wsPort"
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found" });
    }

    const camera = cameraResult.rows[0];

    if (!camera.username || !camera.password) {
      return res.status(400).json({ message: "Camera credentials not configured" });
    }

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      wsPort: camera.wsPort,
      timeout: 30000,
    });

    sec100Service.setCredentials(camera.username, camera.password);

    const videoBuffer = await sec100Service.downloadFile("latestEventRecording");

    res.set({
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="event-${Date.now()}.mp4"`,
    });

    return res.status(200).send(Buffer.from(videoBuffer));
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to download event recording",
      error: error.message,
    });
  }
};

const deleteCameraFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ message: "Filename is required" });
    }

    const cameraResult = await dbPool.query(
      `SELECT 
        id,
        title,
        ip_address as "ipAddress",
        username,
        password
      FROM camera
      WHERE id = $1 AND active = true`,
      [id],
    );

    if (cameraResult.rows.length === 0) {
      return res.status(404).json({ message: "Camera not found or inactive" });
    }

    const camera = cameraResult.rows[0];

    if (!camera.username || !camera.password) {
      return res.status(400).json({
        message: "Camera credentials not configured for authenticated delete",
      });
    }

    const sec100Service = new SEC100CameraService({
      ipAddress: camera.ipAddress,
      timeout: 30000,
    });

    sec100Service.setCredentials(camera.username, camera.password);

    const result = await sec100Service.deleteFile(filename);

    return res.status(200).json({
      success: result.success,
      message: result.message,
      filename,
    });
  } catch (error: any) {
    console.error("[Camera API] Delete file error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
};

export {
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  triggerByController,
  triggerSnapshot,
  getLiveImage,
  getEventList,
  triggerEvent,
  updateTriggerSettings,
  downloadSnapshot,
  downloadFile,
  downloadEvent,
  deleteCameraFile,
};
