import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { JobFileWatcherService, JobFileChangeEvent } from "./job-file-watcher.service";
import JobChangeEventModel from "../models/mongo/job-change-event.model";
import JobBaselineModel from "../models/mongo/job-baseline.model";
import { dbPool } from "../config/db";
import { hashContent, findJobFilesInWatchlogDir, createSimpleDiff } from "../utils/job-file-utils";

const MAX_STORED_DIFF_LENGTH = 200_000;

function capDiff(s: string): string {
  if (s.length <= MAX_STORED_DIFF_LENGTH) return s;
  return `${s.slice(0, MAX_STORED_DIFF_LENGTH)}\n\n… (truncated)`;
}

export class JobDatPipelineService {
  private fileWatcher: JobFileWatcherService;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.fileWatcher = new JobFileWatcherService();
    this.io = io;
  }

  start(): void {
    this.fileWatcher.start();

    this.fileWatcher.on("job-file-change", async (data: JobFileChangeEvent) => {
      try {
        await this.processJobFile(data);
      } catch (error) {
        console.error("[JobDatPipeline] Error processing JOB file:", error);
      }
    });

    console.log("[JobDatPipeline] Started.");
  }

  stop(): void {
    this.fileWatcher.stop();
    console.log("[JobDatPipeline] Stopped.");
  }

  async scanAndProcess(): Promise<{ scanned: number; processed: number; errors: string[] }> {
    const files = findJobFilesInWatchlogDir();
    const errors: string[] = [];
    let processed = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const jobName = fileName.replace(/\.JBI$/i, "");
        const folderName = path.basename(path.dirname(filePath));
        const escapedJobName = jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ipAddress = folderName.replace(new RegExp(`_${escapedJobName}$`), "");

        const event: JobFileChangeEvent = {
          ipAddress,
          jobName,
          filePath,
          changeType: "added",
          content,
          fileModifiedAt: stats.mtime,
        };
        await this.processJobFile(event);
        processed++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[JobDatPipeline] Manual scan: ${files.length} files found, ${processed} processed`);
    return { scanned: files.length, processed, errors };
  }

  private async processJobFile(data: JobFileChangeEvent): Promise<void> {
    const { ipAddress, jobName, content } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[JobDatPipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;
    const newHash = hashContent(content);

    const baseline = await JobBaselineModel.findOne({
      controllerId,
      jobName,
    });

    if (!baseline) {
      await JobBaselineModel.create({
        controllerId,
        jobName,
        contentHash: newHash,
        snapshotContent: content,
        lastCheckedAt: new Date(),
      });
      await JobChangeEventModel.create({
        controllerId,
        controllerName,
        jobName,
        detectedAt: new Date(),
        changeType: "added",
        newContentHash: newHash,
        newContent: content,
      });
      console.log(`[JobDatPipeline] Saved new baseline and JobChangeEvent (added) for ${controllerName}/${jobName}`);
    } else if (baseline.contentHash !== newHash) {
      const previousSnap =
        typeof baseline.snapshotContent === "string" ? baseline.snapshotContent : "";
      const diffRaw = createSimpleDiff(previousSnap, content);
      await JobChangeEventModel.create({
        controllerId,
        controllerName,
        jobName,
        detectedAt: new Date(),
        changeType: "modified",
        diff: capDiff(diffRaw),
        previousContentHash: baseline.contentHash,
        newContentHash: newHash,
        previousContent: previousSnap,
        newContent: content,
      });

      await JobBaselineModel.findOneAndUpdate(
        { controllerId, jobName },
        {
          contentHash: newHash,
          snapshotContent: content,
          lastCheckedAt: new Date(),
        }
      );

      console.log(`[JobDatPipeline] Saved JobChangeEvent (modified) for ${controllerName}/${jobName}`);
    } else {
      const patch: { lastCheckedAt: Date; snapshotContent?: string } = {
        lastCheckedAt: new Date(),
      };
      if (!baseline.snapshotContent) {
        patch.snapshotContent = content;
      }
      await JobBaselineModel.findOneAndUpdate({ controllerId, jobName }, patch);
    }

    this.io.to(`controller:${controllerId}`).emit("job-change:new", {
      controllerId,
      controllerName,
      jobName,
      detectedAt: new Date().toISOString(),
    });
  }

  private async getControllerByIP(
    ipAddress: string
  ): Promise<{ id: string; name: string; ip_address: string } | null> {
    try {
      const result = await dbPool.query(
        `SELECT id, ip_address, name FROM controller WHERE ip_address = $1`,
        [ipAddress]
      );
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error("[JobDatPipeline] Error fetching controller:", error);
      return null;
    }
  }
}
