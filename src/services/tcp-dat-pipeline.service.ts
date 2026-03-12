import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { ToolFileWatcherService, ToolCndChangeEvent } from "./tool-file-watcher.service";
import TcpSnapshotModel from "../models/mongo/tcp-snapshot.model";
import { dbPool } from "../config/db";
import { ParsedTool, parseToolCnd } from "../utils/tool-cnd-parser";
import { findFilesInWatchlogDir } from "../utils/scan-watchlog-dir";

function toolsEqual(a: ParsedTool[], b: ParsedTool[] | null | undefined): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ta = a[i];
    const tb = b[i];
    if (
      ta.toolNumber !== tb.toolNumber ||
      ta.name !== tb.name ||
      ta.tcp.x !== tb.tcp.x ||
      ta.tcp.y !== tb.tcp.y ||
      ta.tcp.z !== tb.tcp.z ||
      ta.tcp.rx !== tb.tcp.rx ||
      ta.tcp.ry !== tb.tcp.ry ||
      ta.tcp.rz !== tb.tcp.rz ||
      ta.cog.xg !== tb.cog.xg ||
      ta.cog.yg !== tb.cog.yg ||
      ta.cog.zg !== tb.cog.zg ||
      ta.weight !== tb.weight ||
      ta.inertia.ix !== tb.inertia.ix ||
      ta.inertia.iy !== tb.inertia.iy ||
      ta.inertia.iz !== tb.inertia.iz
    ) {
      return false;
    }
  }
  return true;
}

export class TcpDatPipelineService {
  private fileWatcher: ToolFileWatcherService;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.fileWatcher = new ToolFileWatcherService();
    this.io = io;
  }

  start(): void {
    this.fileWatcher.start();

    this.fileWatcher.on("tool-cnd-change", async (data: ToolCndChangeEvent) => {
      try {
        await this.processToolCnd(data);
      } catch (error) {
        console.error("[TcpDatPipeline] Error processing TOOL.CND:", error);
      }
    });

    console.log("[TcpDatPipeline] Started.");
  }

  stop(): void {
    this.fileWatcher.stop();
    console.log("[TcpDatPipeline] Stopped.");
  }

  async scanAndProcess(): Promise<{ scanned: number; processed: number; errors: string[] }> {
    const files = findFilesInWatchlogDir("TOOL.CND", "_TOOL");
    const errors: string[] = [];
    let processed = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const stats = fs.statSync(filePath);
        const folderName = path.basename(path.dirname(filePath));
        const ipAddress = folderName.replace("_TOOL", "");
        const { tools } = parseToolCnd(content);
        const event: ToolCndChangeEvent = {
          ipAddress,
          filePath,
          changeType: "added",
          tools,
          fileModifiedAt: stats.mtime,
        };
        await this.processToolCnd(event);
        processed++;
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[TcpDatPipeline] Manual scan: ${files.length} files found, ${processed} processed`);
    return { scanned: files.length, processed, errors };
  }

  private async processToolCnd(data: ToolCndChangeEvent): Promise<void> {
    const { ipAddress, tools } = data;

    const controller = await this.getControllerByIP(ipAddress);
    if (!controller) {
      console.warn(`[TcpDatPipeline] No controller found for IP: ${ipAddress}`);
      return;
    }

    const controllerId = controller.id;
    const controllerName = controller.name;

    const lastDoc = await TcpSnapshotModel.findOne({ controllerId })
      .sort({ recordedAt: -1 })
      .lean();

    const lastTools = lastDoc?.tools as ParsedTool[] | undefined;
    const hasChanged = !toolsEqual(tools, lastTools);

    if (!hasChanged) {
      console.log(`[TcpDatPipeline] No change for ${controllerName} (${ipAddress}), skipping insert`);
      return;
    }

    const toolsData = tools.map((t) => ({
      toolNumber: t.toolNumber,
      name: t.name,
      tcp: t.tcp,
      cog: t.cog,
      weight: t.weight,
      inertia: t.inertia,
    }));

    const recordedAt = new Date();
    await TcpSnapshotModel.create({
      controllerId,
      controllerName,
      tools: toolsData,
      recordedAt,
    });

    console.log(`[TcpDatPipeline] Saved new TcpSnapshot for ${controllerName} (${ipAddress}): ${tools.length} tools`);

    this.io.to(`controller:${controllerId}`).emit("tcp-snapshot:new", {
      controllerId,
      controllerName,
      tools: toolsData,
      recordedAt: recordedAt.toISOString(),
    });
    this.io.emit("tcp-snapshot:update", { controllerId, controllerName });
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
      console.error("[TcpDatPipeline] Error fetching controller:", error);
      return null;
    }
  }
}
