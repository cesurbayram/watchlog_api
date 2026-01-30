import crypto from "crypto";
import { SEC100SnapshotResponse, SEC100SnapshotResult, SEC100CameraConfig } from "../models/sec100-dto";

export class SEC100CameraService {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private username?: string;
  private password?: string;

  constructor(config: SEC100CameraConfig) {
    this.baseUrl = `http://${config.ipAddress}`;
    this.timeout = config.timeout || 10000;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.username = config.username;
    this.password = config.password;
  }

  async triggerNamedSnapshot(snapshotName: string): Promise<SEC100SnapshotResult> {
    try {
      const sanitizedName = snapshotName.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

      const url = `${this.baseUrl}/authenticationFree/SnapshotTriggerNamedSnapshot?${sanitizedName}`;

      console.log(`[SEC100] Triggering named snapshot: ${sanitizedName}`);
      console.log(`[SEC100] URL: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SEC100SnapshotResponse = await response.json();

      console.log(`[SEC100] Response:`, data);

      return {
        success: data.data.result === 0,
        result: data.data.result,
        message: this.getResultMessage(data.data.result),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[SEC100] Snapshot error:`, error.message);

      if (error.name === "AbortError") {
        throw new Error(`Camera timeout after ${this.timeout}ms`);
      }

      throw new Error(`Failed to trigger snapshot: ${error.message}`);
    }
  }

  async triggerSnapshot(): Promise<SEC100SnapshotResult> {
    try {
      const url = `${this.baseUrl}/authenticationFree/SnapshotTriggerSnapshot`;

      console.log(`[SEC100] Triggering snapshot`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SEC100SnapshotResponse = await response.json();

      return {
        success: data.data.result === 0,
        result: data.data.result,
        message: this.getResultMessage(data.data.result),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[SEC100] Snapshot error:`, error.message);

      if (error.name === "AbortError") {
        throw new Error(`Camera timeout after ${this.timeout}ms`);
      }

      throw new Error(`Failed to trigger snapshot: ${error.message}`);
    }
  }

  setCredentials(username: string, password: string): void {
    this.username = username;
    this.password = password;
  }

  async triggerEventRecording(): Promise<SEC100SnapshotResult> {
    try {
      const url = `${this.baseUrl}/authenticationFree/EventTriggerEvent`;

      console.log(`[SEC100] Triggering event recording`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SEC100SnapshotResponse = await response.json();

      return {
        success: data.data.result === 0,
        result: data.data.result,
        message: this.getEventRecordingResultMessage(data.data.result),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[SEC100] Event recording error:`, error.message);

      if (error.name === "AbortError") {
        throw new Error(`Camera timeout after ${this.timeout}ms`);
      }

      throw new Error(`Failed to trigger event recording: ${error.message}`);
    }
  }

  async captureLiveImage(): Promise<Buffer> {
    try {
      const url = `${this.baseUrl}/authenticationFree/liveJpegImage`;

      console.log(`[SEC100] Capturing live JPEG image`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("image/jpeg")) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.error(`[SEC100] Live image capture error:`, error.message);

      if (error.name === "AbortError") {
        throw new Error(`Camera timeout after ${this.timeout}ms`);
      }

      throw new Error(`Failed to capture live image: ${error.message}`);
    }
  }

  private getResultMessage(result: number): string {
    switch (result) {
      case 0:
        return "Snapshot captured successfully";
      case 1:
        return "Snapshot mode not enabled on camera";
      case 2:
        return "Camera snapshot system busy";
      case 3:
        return "Invalid filename provided";
      default:
        return `Unknown result code: ${result}`;
    }
  }

  private getEventRecordingResultMessage(result: number): string {
    switch (result) {
      case 0:
        return "Event recording triggered successfully";
      case 1:
        return "Event recording mode not enabled on camera";
      case 2:
        return "Camera event recording system busy";
      case 3:
        return "Invalid event name provided";
      default:
        return `Unknown result code: ${result}`;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/DeviceIdent`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error(`[SEC100] Connection test failed:`, error);
      return false;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        console.warn(`[SEC100] ${operation} failed (attempt ${attempt}/${this.maxRetries}):`, error.message);

        if (error.name === "AbortError" || attempt === this.maxRetries) {
          break;
        }

        await this.delay(this.retryDelay * attempt);
      }
    }

    throw lastError || new Error(`${operation} failed after ${this.maxRetries} attempts`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async triggerNamedSnapshotWithRetry(snapshotName: string): Promise<SEC100SnapshotResult> {
    return this.withRetry(() => this.triggerNamedSnapshot(snapshotName), "Named snapshot trigger");
  }

  async triggerSnapshotWithRetry(): Promise<SEC100SnapshotResult> {
    return this.withRetry(() => this.triggerSnapshot(), "Snapshot trigger");
  }

  async triggerEventRecordingWithRetry(): Promise<SEC100SnapshotResult> {
    return this.withRetry(() => this.triggerEventRecording(), "Event recording trigger");
  }

  async captureLiveImageWithRetry(): Promise<Buffer> {
    return this.withRetry(() => this.captureLiveImage(), "Live image capture");
  }

  async downloadLatestSnapshot(): Promise<Buffer> {
    if (!this.username || !this.password) {
      throw new Error("Username and password required for downloads");
    }

    try {
      console.log(`[SEC100] Downloading latest snapshot`);

      const challengeRes = await fetch(`${this.baseUrl}/api/getChallenge`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify({ data: { user: this.username } }),
      });

      if (!challengeRes.ok) {
        throw new Error(`Challenge failed: ${challengeRes.status}`);
      }

      const { challenge } = await challengeRes.json();

      let ha1: string;
      if (challenge.salt === null || challenge.salt === undefined) {
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}`).digest("hex");
      } else {
        const saltStr = String.fromCharCode(...challenge.salt);
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}:${saltStr}`).digest("hex");
      }

      const ha2 = crypto.createHash("sha256").update(`POST:latestSnapshot`).digest("hex");
      const response = crypto.createHash("sha256").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");

      const downloadRes = await fetch(`${this.baseUrl}/file/download/latestSnapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            nonce: challenge.nonce,
            opaque: challenge.opaque,
            realm: challenge.realm,
            response: response,
            user: this.username,
          },
        }),
      });

      if (!downloadRes.ok) {
        throw new Error(`Download failed: HTTP ${downloadRes.status}`);
      }

      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      console.log(`[SEC100] Downloaded snapshot (${buffer.length} bytes)`);
      return buffer;
    } catch (error: any) {
      console.error(`[SEC100] Download snapshot error:`, error.message);
      throw new Error(`Failed to download snapshot: ${error.message}`);
    }
  }

  async downloadFile(filename: string): Promise<Buffer> {
    if (!this.username || !this.password) {
      throw new Error("Username and password required for downloads");
    }

    try {
      console.log(`[SEC100] Downloading file: ${filename}`);

      const challengeRes = await fetch(`${this.baseUrl}/api/getChallenge`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify({ data: { user: this.username } }),
      });

      if (!challengeRes.ok) {
        throw new Error(`Challenge failed: ${challengeRes.status}`);
      }

      const { challenge } = await challengeRes.json();

      let ha1: string;
      if (challenge.salt === null || challenge.salt === undefined) {
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}`).digest("hex");
      } else {
        const saltStr = String.fromCharCode(...challenge.salt);
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}:${saltStr}`).digest("hex");
      }

      const ha2 = crypto.createHash("sha256").update(`POST:${filename}`).digest("hex");
      const response = crypto.createHash("sha256").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");

      const downloadRes = await fetch(`${this.baseUrl}/file/download/${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            nonce: challenge.nonce,
            opaque: challenge.opaque,
            realm: challenge.realm,
            response: response,
            user: this.username,
          },
        }),
      });

      if (!downloadRes.ok) {
        throw new Error(`Download failed: HTTP ${downloadRes.status}`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.error(`[SEC100] Download file error:`, error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async getEventList(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/EventList`, {
        method: "GET",
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data;
    } catch (error: any) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error("Request timeout - camera not responding");
      }
      throw new Error(`Failed to get event list: ${error.message}`);
    }
  }

  async downloadLatestEventRecording(): Promise<Buffer> {
    if (!this.username || !this.password) {
      throw new Error("Username and password required for downloads");
    }

    try {
      console.log(`[SEC100] Downloading latest event recording`);

      const challengeRes = await fetch(`${this.baseUrl}/api/getChallenge`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify({ data: { user: this.username } }),
      });

      if (!challengeRes.ok) {
        throw new Error(`Challenge failed: ${challengeRes.status}`);
      }

      const { challenge } = await challengeRes.json();

      let ha1: string;
      if (challenge.salt === null || challenge.salt === undefined) {
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}`).digest("hex");
      } else {
        const saltStr = String.fromCharCode(...challenge.salt);
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}:${saltStr}`).digest("hex");
      }

      const ha2 = crypto.createHash("sha256").update(`POST:latestEventRecording`).digest("hex");
      const response = crypto.createHash("sha256").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");

      const downloadRes = await fetch(`${this.baseUrl}/file/download/latestEventRecording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            nonce: challenge.nonce,
            opaque: challenge.opaque,
            realm: challenge.realm,
            response: response,
            user: this.username,
          },
        }),
      });

      if (!downloadRes.ok) {
        throw new Error(`Download failed: HTTP ${downloadRes.status}`);
      }

      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      console.log(`[SEC100] Downloaded event recording (${buffer.length} bytes)`);
      return buffer;
    } catch (error: any) {
      console.error(`[SEC100] Download event error:`, error.message);
      throw new Error(`Failed to download event: ${error.message}`);
    }
  }

  async deleteFile(filename: string): Promise<{ success: boolean; message: string }> {
    if (!this.username || !this.password) {
      throw new Error("Username and password required for file deletion");
    }

    try {
      console.log(`[SEC100] Deleting file: ${filename}`);

      const challengeRes = await fetch(`${this.baseUrl}/api/getChallenge`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify({ data: { user: this.username } }),
      });

      if (!challengeRes.ok) {
        throw new Error(`Challenge failed: ${challengeRes.status}`);
      }

      const { challenge } = await challengeRes.json();

      let ha1: string;
      if (challenge.salt === null || challenge.salt === undefined) {
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}`).digest("hex");
      } else {
        const saltStr = String.fromCharCode(...challenge.salt);
        ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}:${saltStr}`).digest("hex");
      }

      const ha2 = crypto.createHash("sha256").update(`POST:DeleteFile`).digest("hex");
      const response = crypto.createHash("sha256").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");

      const deleteRes = await fetch(`${this.baseUrl}/api/DeleteFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            nonce: challenge.nonce,
            opaque: challenge.opaque,
            realm: challenge.realm,
            response: response,
            user: this.username,
          },
          data: {
            fileName: filename,
          },
        }),
      });

      if (!deleteRes.ok) {
        throw new Error(`Delete failed: HTTP ${deleteRes.status}`);
      }

      const result = await deleteRes.json();
      console.log(`[SEC100] Delete result:`, result);

      if (result.header?.status !== 0) {
        throw new Error(result.header?.message || "Delete failed");
      }

      return {
        success: true,
        message: "File deleted successfully",
      };
    } catch (error: any) {
      console.error(`[SEC100] Delete file error:`, error.message);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async updateEventRecordingSettings(eventTimeBeforeTrigger: number, eventTimeAfterTrigger: number): Promise<{ success: boolean; message: string }> {
    if (!this.username || !this.password) {
      throw new Error("Username and password required for settings update");
    }

    try {
      const authenticatedPost = async (endpoint: string, data: any): Promise<{ success: boolean; response: any }> => {
        const challengeRes = await fetch(`${this.baseUrl}/api/getChallenge`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: JSON.stringify({ data: { user: this.username } }),
        });

        if (!challengeRes.ok) {
          throw new Error(`Challenge failed: ${challengeRes.status}`);
        }

        const { challenge } = await challengeRes.json();

        let ha1: string;
        if (challenge.salt === null || challenge.salt === undefined) {
          ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}`).digest("hex");
        } else {
          const saltStr = String.fromCharCode(...challenge.salt);
          ha1 = crypto.createHash("sha256").update(`${this.username}:${challenge.realm}:${this.password}:${saltStr}`).digest("hex");
        }

        const ha2 = crypto.createHash("sha256").update(`POST:${endpoint}`).digest("hex");
        const response = crypto.createHash("sha256").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");

        const res = await fetch(`${this.baseUrl}/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            header: {
              user: this.username,
              realm: challenge.realm,
              nonce: challenge.nonce,
              opaque: challenge.opaque,
              response: response,
            },
            data,
          }),
        });

        const responseData = await res.json();

        return {
          success: res.ok && responseData.header?.status === 0,
          response: responseData,
        };
      };

      const result1 = await authenticatedPost("EventEnableRecording", {
        EventEnableRecording: 1,
      });

      const result2 = await authenticatedPost("EventTimeBeforeTrigger", {
        EventTimeBeforeTrigger: eventTimeBeforeTrigger,
      });

      const result3 = await authenticatedPost("EventTimeAfterTrigger", {
        EventTimeAfterTrigger: eventTimeAfterTrigger,
      });

      const allSuccess = result1.success && result2.success && result3.success;

      if (!allSuccess) {
        throw new Error("Some settings failed to update on camera");
      }

      return {
        success: true,
        message: "Event recording settings updated successfully",
      };
    } catch (error: any) {
      console.error(`[SEC100] Update settings error:`, error.message);
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }
}
