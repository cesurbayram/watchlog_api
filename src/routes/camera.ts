import { Router } from "express";
import {
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
} from "../controllers/camera-controller";

const cameraRouter = Router();

cameraRouter.get("/", getCameras);
cameraRouter.get("/:id", getCameraById);
cameraRouter.post("/", createCamera);
cameraRouter.put("/:id", updateCamera);
cameraRouter.delete("/:id", deleteCamera);

cameraRouter.post("/trigger-by-controller", triggerByController);
cameraRouter.post("/:id/snapshot", triggerSnapshot);
cameraRouter.get("/:id/live-image", getLiveImage);
cameraRouter.get("/:id/event-list", getEventList);
cameraRouter.post("/:id/trigger-event", triggerEvent);
cameraRouter.post("/:id/update-trigger-settings", updateTriggerSettings);
cameraRouter.post("/:id/download-snapshot", downloadSnapshot);
cameraRouter.post("/:id/download-file", downloadFile);
cameraRouter.post("/:id/download-event", downloadEvent);
cameraRouter.post("/:id/delete-file", deleteCameraFile);

export default cameraRouter;
