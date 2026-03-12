import mongoose, { Schema, Document } from "mongoose";

export interface IR1Values {
  S?: number;
  L?: number;
  U?: number;
  R?: number;
  B?: number;
  T?: number;
}

export interface IAbsoSnapshot extends Document {
  controllerId: string;
  controllerName?: string;
  currValue: {
    R1: IR1Values;
  };
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AbsoSnapshotSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
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
    recordedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

AbsoSnapshotSchema.index({ controllerId: 1, recordedAt: -1 });

export default mongoose.model<IAbsoSnapshot>("AbsoSnapshot", AbsoSnapshotSchema);
