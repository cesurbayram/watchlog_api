import mongoose, { Schema, Document } from "mongoose";

export interface IJobBaseline extends Document {
  controllerId: string;
  jobName: string;
  contentHash: string;
  lastCheckedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobBaselineSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    jobName: { type: String, required: true, index: true },
    contentHash: { type: String, required: true },
    lastCheckedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

JobBaselineSchema.index({ controllerId: 1, jobName: 1 }, { unique: true });

export default mongoose.model<IJobBaseline>("JobBaseline", JobBaselineSchema);
