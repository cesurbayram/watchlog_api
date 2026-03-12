import mongoose, { Schema, Document } from "mongoose";

export interface IToolData {
  toolNumber: number;
  name: string;
  tcp: { x: number; y: number; z: number; rx: number; ry: number; rz: number };
  cog: { xg: number; yg: number; zg: number };
  weight: number;
  inertia: { ix: number; iy: number; iz: number };
}

export interface ITcpSnapshot extends Document {
  controllerId: string;
  controllerName?: string;
  tools: IToolData[];
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ToolDataSchema = new Schema(
  {
    toolNumber: { type: Number, required: true },
    name: { type: String, default: "" },
    tcp: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
      rx: { type: Number, default: 0 },
      ry: { type: Number, default: 0 },
      rz: { type: Number, default: 0 },
    },
    cog: {
      xg: { type: Number, default: 0 },
      yg: { type: Number, default: 0 },
      zg: { type: Number, default: 0 },
    },
    weight: { type: Number, default: 0 },
    inertia: {
      ix: { type: Number, default: 0 },
      iy: { type: Number, default: 0 },
      iz: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const TcpSnapshotSchema = new Schema(
  {
    controllerId: { type: String, required: true, index: true },
    controllerName: { type: String },
    tools: [ToolDataSchema],
    recordedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

TcpSnapshotSchema.index({ controllerId: 1, recordedAt: -1 });

export default mongoose.model<ITcpSnapshot>("TcpSnapshot", TcpSnapshotSchema);
