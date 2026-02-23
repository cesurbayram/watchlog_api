import mongoose, { Schema } from "mongoose";

export interface IWeldHeader {
  _id: string;
  Cell: string;
  CreatedAt: Date;
  Factory: string;
  GroupType: string;
  IpAdress: string;
  JobName: string;
  Line: string;
  MachineName: string;
  PartItemNumber: string;
  PartSerialID: string;
  SeamNumber: number;
  SetCurrent: number;
  SetVoltage: number;
  ToolNo: number;
  WeldLength: number;
  WeldingSpeed: number;
  AvarageCurrent: number;
  AvarageGasFlow: number;
  AvarageMotorTorqueM1: number;
  AvarageMotorTorqueM2: number;
  AvarageVoltage: number;
  AvarageWireSpeed: number;
  WeldDuration: number;
  WireConsumption: number;
}

const WeldHeaderSchema = new Schema(
  {
    _id: { type: String, required: true },
    Cell: { type: String, default: "" },
    CreatedAt: { type: Date, default: null },
    Factory: { type: String, default: "" },
    GroupType: { type: String, default: "" },
    IpAdress: { type: String, default: "" },
    JobName: { type: String, default: "" },
    Line: { type: String, default: "" },
    MachineName: { type: String, default: "" },
    PartItemNumber: { type: String, default: "" },
    PartSerialID: { type: String, default: "" },
    SeamNumber: { type: Number, default: 0 },
    SetCurrent: { type: Number, default: 0 },
    SetVoltage: { type: Number, default: 0 },
    ToolNo: { type: Number, default: 0 },
    WeldLength: { type: Number, default: 0 },
    WeldingSpeed: { type: Number, default: 0 },
    AvarageCurrent: { type: Number, default: 0 },
    AvarageGasFlow: { type: Number, default: 0 },
    AvarageMotorTorqueM1: { type: Number, default: 0 },
    AvarageMotorTorqueM2: { type: Number, default: 0 },
    AvarageVoltage: { type: Number, default: 0 },
    AvarageWireSpeed: { type: Number, default: 0 },
    WeldDuration: { type: Number, default: 0 },
    WireConsumption: { type: Number, default: 0 },
  },
  { collection: "WeldHeaders" },
);

WeldHeaderSchema.index({ IpAdress: 1, CreatedAt: -1 });
WeldHeaderSchema.index({ Factory: 1, Line: 1, Cell: 1 });

export default mongoose.model<IWeldHeader>("WeldHeader", WeldHeaderSchema);
