import mongoose, { Schema, Document } from "mongoose";

export interface IJobWatchTarget extends Document {
  controllerId: string;
  jobName: string;
  createdAt: Date;
}

const JobWatchTargetSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    jobName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

JobWatchTargetSchema.index({ controllerId: 1, jobName: 1 }, { unique: true });

export default mongoose.model<IJobWatchTarget>("JobWatchTarget", JobWatchTargetSchema);
