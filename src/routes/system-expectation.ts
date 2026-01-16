import { Router } from "express";
import {
  createWorkOrder,
  deleteWorkOrder,
  getAlarmLogDetailByIdAndCode,
  getWorkOrders,
  sendWorkOrderMail,
} from "../controllers/alarm-error-logs-controller";
import {
  createZipBySessionId,
  downloadZipBySessionId,
  getBackupHistoryByControllerId,
  getBackupSessionBySessionId,
  getFileSaveHistory,
  getLogFileContentByControllerId,
  getReadFileBySessionIdWithFileName,
  getSessionFolderFilesBySessionId,
} from "../controllers/cmos-backup-controller";
import { getTeachingLogsByControllerId } from "../controllers/teaching-logs-controller";
import { getTcpLogsByControllerId } from "../controllers/tcp-logs-controller";
import { getAbsoLogsByControllerId } from "../controllers/abso-logs-controller";

const systemExpectationRouter = Router();

systemExpectationRouter.get("/alarm-error-logs/alarm-detail", getAlarmLogDetailByIdAndCode);
systemExpectationRouter.post("/alarm-error-logs/work-order", createWorkOrder);
systemExpectationRouter.get("/alarm-error-logs/work-order", getWorkOrders);
systemExpectationRouter.delete("/alarm-error-logs/work-order/:workOrderId", deleteWorkOrder);
systemExpectationRouter.post("/alarm-error-logs/work-order/send-mail", sendWorkOrderMail);

systemExpectationRouter.get("/cmos-backup/backup-history/:controllerId", getBackupHistoryByControllerId);
systemExpectationRouter.get("/cmos-backup/backup-session/:sessionId", getBackupSessionBySessionId);
systemExpectationRouter.post("/cmos-backup/create-zip/:sessionId", createZipBySessionId);
systemExpectationRouter.get("/cmos-backup/download-zip/:sessionId", downloadZipBySessionId);
systemExpectationRouter.get("/cmos-backup/file-save-history/:controllerId", getFileSaveHistory);
systemExpectationRouter.get("/cmos-backup/log-file-content/:controllerId", getLogFileContentByControllerId);
systemExpectationRouter.get("/cmos-backup/read-file/:sessionId/:fileName", getReadFileBySessionIdWithFileName);
systemExpectationRouter.get("/cmos-backup/session-folder-files/:sessionId", getSessionFolderFilesBySessionId);

systemExpectationRouter.get("/teaching-logs/:controllerId", getTeachingLogsByControllerId);

systemExpectationRouter.get("/tcp-logs/:controllerId", getTcpLogsByControllerId);

systemExpectationRouter.get("/abso-logs/:controllerId", getAbsoLogsByControllerId);

export default systemExpectationRouter;
