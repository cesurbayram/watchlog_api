import mongoose, { Schema, Document } from "mongoose";

export interface IAbsoEvent extends Document {
  controllerId: string;
  controllerName?: string;
  eventIndex: number;
  eventDate: Date | null;
  groupNumber: string;
  axisNumber: string;
  setValue: string;
  currValue: {
    R1: {
      S?: number;
      L?: number;
      U?: number;
      R?: number;
      B?: number;
      T?: number;
    };
  };
  rawEntry: string;
  createdAt: Date;
  updatedAt: Date;
}

const AbsoEventSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    eventIndex: { type: Number, required: true },
    eventDate: { type: Date, default: null, index: true },
    groupNumber: { type: String },
    axisNumber: { type: String },
    setValue: { type: String },
    currValue: {
      R1: {
        S: { type: Number },
        L: { type: Number },
        U: { type: Number },
        R: { type: Number },
        B: { type: Number },
        T: { type: Number },
      },
    },
    rawEntry: { type: String },
  },
  { timestamps: true }
);

AbsoEventSchema.index({ controllerId: 1, eventDate: 1, groupNumber: 1, axisNumber: 1 }, { unique: true });

export default mongoose.model<IAbsoEvent>("AbsoEvent", AbsoEventSchema);
