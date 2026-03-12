import { TCPDataEntry } from "../models/tcp-event-dto";
import { IToolData } from "../models/mongo/tcp-snapshot.model";

export function tcpSnapshotToDataEntries(
  doc: { tools?: IToolData[]; recordedAt?: Date; controllerId?: string; controllerName?: string }
): TCPDataEntry[] {
  const entries: TCPDataEntry[] = [];
  const dateStr = doc.recordedAt ? new Date(doc.recordedAt).toISOString() : "";
  let index = 0;
  if (!doc.tools || doc.tools.length === 0) return entries;

  const tcpNames = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
  const cogNames = ["Xg", "Yg", "Zg"];
  const inertiaNames = ["Ix", "Iy", "Iz"];

  for (const tool of doc.tools || []) {
    const n = tool.toolNumber + 1;

    for (let k = 0; k < 6; k++) {
      const val = [tool.tcp.x, tool.tcp.y, tool.tcp.z, tool.tcp.rx, tool.tcp.ry, tool.tcp.rz][k];
      entries.push(createEntry(index++, dateStr, n, 1, k, tcpNames[k], "TOOL Data", val, doc));
    }
    for (let k = 0; k < 3; k++) {
      const val = [tool.cog.xg, tool.cog.yg, tool.cog.zg][k];
      entries.push(createEntry(index++, dateStr, n, 9, k, cogNames[k], "TOOL Geometry", val, doc));
    }
    entries.push(createEntry(index++, dateStr, n, 2, 0, "W", "Weight", tool.weight, doc));
    for (let k = 0; k < 3; k++) {
      const val = [tool.inertia.ix, tool.inertia.iy, tool.inertia.iz][k];
      entries.push(createEntry(index++, dateStr, n, 9, 3 + k, inertiaNames[k], "TOOL Geometry", val, doc));
    }
  }

  return entries;
}

function createEntry(
  index: number,
  date: string,
  toolNumber: number,
  parameterGroup: number,
  parameterIndex: number,
  parameterName: string,
  parameterGroupName: string,
  value: number,
  doc: { controllerId?: string; controllerName?: string }
): TCPDataEntry {
  const elementNumber = `${toolNumber}-${parameterGroup}-${parameterIndex}`;
  return {
    index,
    date,
    event: "TOOL.CND",
    fileName: "TOOL",
    elementNumber,
    elementValue: String(value),
    parsedElement: {
      toolNumber,
      parameterGroup,
      parameterGroupName,
      parameterIndex,
      parameterName,
      actualToolNumber: toolNumber - 1,
    },
    rawEntry: "",
    controllerId: doc.controllerId,
    controllerName: doc.controllerName,
  };
}
