import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { JobFileWatcherService, JobFileChangeEvent } from "./job-file-watcher.service";
import JobChangeEventModel from "../models/mongo/job-change-event.model";
import JobBaselineModel from "../models/mongo/job-baseline.model";
import { dbPool } from "../config/db";
import { hashContent, findJobFilesInWatchlogDir } from "../utils/job-file-utils";

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
        lastCheckedAt: new Date(),
      });
      await JobChangeEventModel.create({
        controllerId,
        controllerName,
        jobName,
        detectedAt: new Date(),
        changeType: "added",
        newContentHash: newHash,
      });
      console.log(`[JobDatPipeline] Saved new baseline and JobChangeEvent (added) for ${controllerName}/${jobName}`);
    } else if (baseline.contentHash !== newHash) {
      await JobChangeEventModel.create({
        controllerId,
        controllerName,
        jobName,
        detectedAt: new Date(),
        changeType: "modified",
        diff: `Content hash changed (previous: ${baseline.contentHash.slice(0, 16)}...)`,
        previousContentHash: baseline.contentHash,
        newContentHash: newHash,
      });

      await JobBaselineModel.findOneAndUpdate(
        { controllerId, jobName },
        { contentHash: newHash, lastCheckedAt: new Date() }
      );

      console.log(`[JobDatPipeline] Saved JobChangeEvent (modified) for ${controllerName}/${jobName}`);
    } else {
      await JobBaselineModel.findOneAndUpdate(
        { controllerId, jobName },
        { lastCheckedAt: new Date() }
      );
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
