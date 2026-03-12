import { Router } from "express";
import { getAlarmLogDetailByIdAndCode } from "../controllers/alarm-error-logs-controller";
import {
  createZipBySessionId,
  downloadZipBySessionId,
  getBackupHistoryByControllerId,
  getBackupSessionBySessionId,
  deleteBackupSessionBySessionId,
  getFileSaveHistory,
  getLogFileContentByControllerId,
  getReadFileBySessionIdWithFileName,
  getSessionFolderFilesBySessionId,
  getBackupFoldersForController,
  getBackupFolderFiles,
  getBackupFileContent,
} from "../controllers/cmos-backup-controller";
import {
  getTeachingLogsByControllerId,
  getTeachingEventsFromDatabase,
  getTeachingHistory,
  getAllControllersSummaryEndpoint,
  getTeachingFileNames,
  checkTeachingData,
} from "../controllers/teaching-logs-controller";
import {
  getTcpLogsByControllerId,
  getTcpEventsFromDatabase,
  getTcpHistory,
  getAllControllersTcpSummaryEndpoint,
  checkTcpData,
} from "../controllers/tcp-logs-controller";
import {
  getAbsoLogsByControllerId,
  getAbsoEventsFromDatabase,
  getAbsoHistory,
  getAllControllersAbsoSummaryEndpoint,
  checkAbsoData,
} from "../controllers/abso-logs-controller";
import {
  getAlarmLogsByControllerId,
  getAlarmEventsFromDatabase,
  checkAlarmData,
  getAllControllersAlarmSummaryEndpoint,
} from "../controllers/alarm-logs-controller";
import {
  getJobLogsByControllerId,
  getJobEventsFromDatabase,
  getJobHistory,
  getJobLogsSummary,
  checkJobData,
  triggerJobMonitoringRun,
} from "../controllers/job-logs-controller";
import { scanAndProcessWatchlogFiles } from "../controllers/scan-watchlog-controller";

const systemExpectationRouter = Router();

systemExpectationRouter.get("/alarm-error-logs/alarm-detail", getAlarmLogDetailByIdAndCode);

systemExpectationRouter.get("/cmos-backup/backup-history/:controllerId", getBackupHistoryByControllerId);
systemExpectationRouter.get("/cmos-backup/backup-session/:sessionId", getBackupSessionBySessionId);
systemExpectationRouter.delete("/cmos-backup/backup-session/:sessionId", deleteBackupSessionBySessionId);
systemExpectationRouter.post("/cmos-backup/create-zip/:sessionId", createZipBySessionId);
systemExpectationRouter.get("/cmos-backup/download-zip/:sessionId", downloadZipBySessionId);
systemExpectationRouter.get("/cmos-backup/file-save-history/:controllerId", getFileSaveHistory);
systemExpectationRouter.get("/cmos-backup/log-file-content/:controllerId", getLogFileContentByControllerId);
systemExpectationRouter.get("/cmos-backup/read-file/:sessionId/:fileName", getReadFileBySessionIdWithFileName);
systemExpectationRouter.get("/cmos-backup/session-folder-files/:sessionId", getSessionFolderFilesBySessionId);
systemExpectationRouter.get("/cmos-backup/controller-backup-folders/:controllerId", getBackupFoldersForController);
systemExpectationRouter.get("/cmos-backup/backup-folder-files/:folderName", getBackupFolderFiles);
systemExpectationRouter.get("/cmos-backup/backup-file-content/:folderName/:fileName", getBackupFileContent);

systemExpectationRouter.get("/teaching-logs/:controllerId", getTeachingLogsByControllerId);
systemExpectationRouter.get("/teaching-logs/:controllerId/from-db", getTeachingEventsFromDatabase);
systemExpectationRouter.get("/teaching-logs/:controllerId/history", getTeachingHistory);
systemExpectationRouter.get("/teaching-logs/:controllerId/files", getTeachingFileNames);
systemExpectationRouter.get("/teaching-logs/:controllerId/check", checkTeachingData);
systemExpectationRouter.get("/teaching-logs-summary", getAllControllersSummaryEndpoint);
systemExpectationRouter.get("/tcp-logs/:controllerId", getTcpLogsByControllerId);
systemExpectationRouter.get("/tcp-logs/:controllerId/from-db", getTcpEventsFromDatabase);
systemExpectationRouter.get("/tcp-logs/:controllerId/history", getTcpHistory);
systemExpectationRouter.get("/tcp-logs/:controllerId/check", checkTcpData);
systemExpectationRouter.get("/tcp-logs-summary", getAllControllersTcpSummaryEndpoint);
systemExpectationRouter.get("/abso-logs/:controllerId", getAbsoLogsByControllerId);
systemExpectationRouter.get("/abso-logs/:controllerId/from-db", getAbsoEventsFromDatabase);
systemExpectationRouter.get("/abso-logs/:controllerId/history", getAbsoHistory);
systemExpectationRouter.get("/abso-logs/:controllerId/check", checkAbsoData);
systemExpectationRouter.get("/abso-logs-summary", getAllControllersAbsoSummaryEndpoint);
systemExpectationRouter.get("/alarm-logs/:controllerId", getAlarmLogsByControllerId);
systemExpectationRouter.get("/alarm-logs/:controllerId/from-db", getAlarmEventsFromDatabase);
systemExpectationRouter.get("/alarm-logs/:controllerId/check", checkAlarmData);
systemExpectationRouter.get("/alarm-logs-summary", getAllControllersAlarmSummaryEndpoint);
systemExpectationRouter.post("/job-logs/trigger-run", triggerJobMonitoringRun);
systemExpectationRouter.get("/job-logs/:controllerId", getJobLogsByControllerId);
systemExpectationRouter.get("/job-logs/:controllerId/from-db", getJobEventsFromDatabase);
systemExpectationRouter.get("/job-logs/:controllerId/history", getJobHistory);
systemExpectationRouter.get("/job-logs/:controllerId/check", checkJobData);
systemExpectationRouter.get("/job-logs-summary", getJobLogsSummary);
systemExpectationRouter.post("/scan-watchlog-files", scanAndProcessWatchlogFiles);

export default systemExpectationRouter;
