import mongoose, { Schema, Document } from "mongoose";

export interface ITCPEvent extends Document {
  controllerId: string;
  controllerName?: string;
  eventIndex: number;
  eventDate: Date | null;
  event: string;
  fileName: string;
  elementNumber: string;
  elementValue: string;
  parsedElement: {
    toolNumber: number;
    parameterGroup: number;
    parameterGroupName: string;
    parameterIndex: number;
    parameterName: string;
    actualToolNumber: number;
  };
  rawEntry: string;
  createdAt: Date;
  updatedAt: Date;
}

const TCPEventSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    eventIndex: { type: Number, required: true },
    eventDate: { type: Date, default: null, index: true },
    event: { type: String },
    fileName: { type: String },
    elementNumber: { type: String },
    elementValue: { type: String },
    parsedElement: {
      toolNumber: { type: Number },
      parameterGroup: { type: Number },
      parameterGroupName: { type: String },
      parameterIndex: { type: Number },
      parameterName: { type: String },
      actualToolNumber: { type: Number },
    },
    rawEntry: { type: String },
  },
  { timestamps: true }
);

TCPEventSchema.index({ controllerId: 1, eventDate: 1, event: 1, elementNumber: 1 }, { unique: true });

export default mongoose.model<ITCPEvent>("TCPEvent", TCPEventSchema);
