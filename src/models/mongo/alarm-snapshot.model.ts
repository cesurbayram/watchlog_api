import mongoose, { Schema, Document } from "mongoose";
import { AlarmCategory, ParsedAlarm } from "../../utils/almhist-dat-parser";

export interface IAlarmSnapshot extends Document {
  controllerId: string;
  controllerName?: string;
  categories: {
    name: AlarmCategory;
    maxCapacity: number;
    currentCount: number;
    alarms: ParsedAlarm[];
  }[];
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlarmEntrySchema = new Schema(
  {
    code: { type: String },
    message: { type: String },
    location: { type: String },
    mode: { type: String },
    programInfo: { type: String },
    recordedAt: { type: String },
    userName: { type: String },
  },
  { _id: false }
);

const CategorySchema = new Schema(
  {
    name: { type: String, required: true },
    maxCapacity: { type: Number, default: 0 },
    currentCount: { type: Number, default: 0 },
    alarms: [AlarmEntrySchema],
  },
  { _id: false }
);

const AlarmSnapshotSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    categories: [CategorySchema],
    recordedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

AlarmSnapshotSchema.index({ controllerId: 1, recordedAt: -1 });

export default mongoose.model<IAlarmSnapshot>("AlarmSnapshot", AlarmSnapshotSchema);
