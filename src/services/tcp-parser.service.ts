import { LogEntry } from "../models/log-content";
import { ParsedElement, TCPDataEntry, TCPComparison, TCPStatistics } from "../models/tcp-event-dto";

export const parseElementNumber = (elementNumber: string): ParsedElement | null => {
  const parts = elementNumber.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const N = parseInt(parts[0]);
  const M = parseInt(parts[1]);
  const K = parseInt(parts[2]);

  let parameterName = "Unknown";
  let parameterGroupName = "Unknown";

  if (M === 1) {
    const toolDataNames = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
    parameterName = toolDataNames[K] || "Unknown";
    parameterGroupName = "TOOL Data";
  } else if (M === 2) {
    const toolDataNames = ["X", "Y", "Z", "Rx", "Ry", "Rz"];
    parameterName = toolDataNames[K] || "Unknown";
    parameterGroupName = "TOOL Data (M=2)";
  } else if (M === 9) {
    const toolGeometryNames = ["Xg", "Yg", "Zg", "Ix", "Iy", "Iz"];
    parameterName = toolGeometryNames[K] || "Unknown";
    parameterGroupName = "TOOL Geometry";
  }

  return {
    toolNumber: N,
    parameterGroup: M,
    parameterGroupName,
    parameterIndex: K,
    parameterName,
    actualToolNumber: N - 1,
  };
};

export const extractTCPDataEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): TCPDataEntry[] => {
  const events: TCPDataEntry[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    const fields = entry.fields || {};
    const fileNameFieldKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "file name");
    const elementNumberKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "element number");
    const elementValueKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "element value");
    const afterEditKey = Object.keys(fields).find((k) => k.trim().toLowerCase() === "after edit");

    let fileName = (fileNameFieldKey ? fields[fileNameFieldKey] : "") || "";
    let elementNumber = (elementNumberKey ? fields[elementNumberKey] : "") || "";
    let elementValue = (elementValueKey ? fields[elementValueKey] : "") || "";
    const afterEdit = (afterEditKey ? fields[afterEditKey] : "") || "";

    if (!elementValue && afterEdit) {
      elementValue = afterEdit;
    }

    if (!fileName && entry.rawData) {
      const m = entry.rawData.match(/FILE NAME\s*:\s*(\S+)/i);
      if (m) fileName = m[1];
    }
    if (!elementNumber && entry.rawData) {
      const m = entry.rawData.match(/ELEMENT NUMBER\s*:\s*([\d-]+)/i);
      if (m) elementNumber = m[1];
    }
    if (!elementValue && entry.rawData) {
      const m = entry.rawData.match(/ELEMENT VALUE\s*:\s*([-+]?\d+(?:\.\d+)?)/i);
      if (m) elementValue = m[1];
    }

    if ((event.includes("other file edit") || event.includes("other file edt")) && fileName.toLowerCase() === "tool") {
      const parsedElement = parseElementNumber(elementNumber);

      if (parsedElement) {
        events.push({
          index: entry.index,
          date: entry.date || "",
          event: entry.event || "",
          fileName,
          elementNumber,
          elementValue,
          parsedElement,
          rawEntry: entry.rawData,
          controllerId,
          controllerName,
        });
      }
    }
  });

  return events.sort((a, b) => {
    if (a.date && b.date) {
      const dateA = new Date(a.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
      const dateB = new Date(b.date.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:$6"));
      return dateB.getTime() - dateA.getTime();
    }
    return b.index - a.index;
  });
};

export const compareTCPValues = (entries: TCPDataEntry[]): TCPComparison[] => {
  if (entries.length < 2) return [];

  const comparisons: TCPComparison[] = [];

  for (let i = 0; i < Math.min(entries.length - 1, 5); i++) {
    const current = entries[i];
    const previous = entries[i + 1];

    if (current.elementNumber === previous.elementNumber) {
      const newVal = parseFloat(current.elementValue) || 0;
      const oldVal = parseFloat(previous.elementValue) || 0;
      const change = newVal - oldVal;
      const changePercent = oldVal !== 0 ? (change / Math.abs(oldVal)) * 100 : 0;

      comparisons.push({
        toolNumber: current.parsedElement.actualToolNumber,
        parameterName: current.parsedElement.parameterName,
        parameterGroupName: current.parsedElement.parameterGroupName,
        elementNumber: current.elementNumber,
        oldValue: oldVal,
        newValue: newVal,
        change,
        changePercent,
      });
    }
  }

  return comparisons;
};

export const calculateTCPStatistics = (events: TCPDataEntry[]): TCPStatistics => {
  const uniqueToolsSet = new Set<string>();
  const changesByParameter: Record<string, number> = {};

  events.forEach((event) => {
    uniqueToolsSet.add(`TOOL ${event.parsedElement.actualToolNumber}`);
    const paramKey = event.parsedElement.parameterName;
    changesByParameter[paramKey] = (changesByParameter[paramKey] || 0) + 1;
  });

  return {
    totalTCPChanges: events.length,
    toolsModified: uniqueToolsSet.size,
    uniqueTools: Array.from(uniqueToolsSet),
    lastChangeDate: events.length > 0 ? events[0].date : undefined,
    changesByParameter,
  };
};
