import mongoose, { Schema, Document } from "mongoose";

export type JobChangeType = "modified" | "added" | "deleted";

export interface IJobChangeEvent extends Document {
  controllerId: string;
  controllerName?: string;
  jobName: string;
  detectedAt: Date;
  changeType: JobChangeType;
  /** Line-based diff; optional in lean queries (select:false). */
  diff?: string;
  previousContentHash?: string;
  newContentHash?: string;
  previousContent?: string;
  newContent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobChangeEventSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    jobName: { type: String, required: true, index: true },
    detectedAt: { type: Date, required: true, default: Date.now, index: true },
    changeType: {
      type: String,
      enum: ["modified", "added", "deleted"],
      required: true,
    },
    diff: { type: String, select: false },
    previousContentHash: { type: String },
    newContentHash: { type: String },
    previousContent: { type: String, select: false },
    newContent: { type: String, select: false },
  },
  { timestamps: true }
);

JobChangeEventSchema.index({ controllerId: 1, detectedAt: -1 });
JobChangeEventSchema.index({ controllerId: 1, jobName: 1, detectedAt: -1 });

export default mongoose.model<IJobChangeEvent>("JobChangeEvent", JobChangeEventSchema);
