import mongoose, { Schema, Document } from "mongoose";

export type JobChangeType = "modified" | "added" | "deleted";

export interface IJobChangeEvent extends Document {
  controllerId: string;
  controllerName?: string;
  jobName: string;
  detectedAt: Date;
  changeType: JobChangeType;
  diff?: string;
  previousContentHash?: string;
  newContentHash?: string;
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
    diff: { type: String },
    previousContentHash: { type: String },
    newContentHash: { type: String },
  },
  { timestamps: true }
);

JobChangeEventSchema.index({ controllerId: 1, detectedAt: -1 });
JobChangeEventSchema.index({ controllerId: 1, jobName: 1, detectedAt: -1 });

export default mongoose.model<IJobChangeEvent>("JobChangeEvent", JobChangeEventSchema);
