import mongoose, { Schema, Document } from "mongoose";

export interface ITeachingEvent extends Document {
  controllerId: string;
  controllerName?: string;
  eventIndex: number;
  eventDate: Date | null;
  eventType: "POINT_MODIFICATION" | "INSTRUCTION_INSERT" | "INSTRUCTION_DELETE" | "TEACH_MODE" | "STOP" | "POWER_OFF" | "POWER_ON";
  fileName?: string;
  lineNumber?: string;
  details: string;
  rawEntry: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeachingEventSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    eventIndex: { type: Number, required: true },
    eventDate: { type: Date, default: null, index: true },
    eventType: {
      type: String,
      enum: ["POINT_MODIFICATION", "INSTRUCTION_INSERT", "INSTRUCTION_DELETE", "TEACH_MODE", "STOP", "POWER_OFF", "POWER_ON"],
      required: true,
    },
    fileName: { type: String },
    lineNumber: { type: String },
    details: { type: String },
    rawEntry: { type: String },
  },
  { timestamps: true }
);

TeachingEventSchema.index({ controllerId: 1, eventDate: 1, eventType: 1, details: 1 }, { unique: true });

export default mongoose.model<ITeachingEvent>("TeachingEvent", TeachingEventSchema);
