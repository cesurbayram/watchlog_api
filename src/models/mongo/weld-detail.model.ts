import mongoose, { Schema, Document } from "mongoose";

export interface IWeldDetail extends Document {
  DataPart: string;
  DateTime: Date;
  ActualVoltage: number;
  ActualCurrent: number;
  ActualWireSpeed: number;
  MotorTorqueM1: number;
  MotorTorqueM2: number;
  ActualGasFlow: number;
}

const WeldDetailSchema = new Schema(
  {
    DataPart: { type: String, required: true, index: true },
    DateTime: { type: Date, required: true },
    ActualVoltage: { type: Number, default: 0 },
    ActualCurrent: { type: Number, default: 0 },
    ActualWireSpeed: { type: Number, default: 0 },
    MotorTorqueM1: { type: Number, default: 0 },
    MotorTorqueM2: { type: Number, default: 0 },
    ActualGasFlow: { type: Number, default: 0 },
  },
  { collection: "WeldDetails" },
);

WeldDetailSchema.index({ DataPart: 1, DateTime: 1 });

export default mongoose.model<IWeldDetail>("WeldDetail", WeldDetailSchema);
