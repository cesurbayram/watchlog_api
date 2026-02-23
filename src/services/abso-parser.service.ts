import { LogEntry } from "../models/log-content";
import { R1Values, AbsoluteDataEntry, AxisComparison, AbsoStatistics } from "../models/abso-event-dto";

export const parseCurrentValue = (currValueText: string): { R1: R1Values } => {
  const values: { R1: R1Values } = { R1: {} };

  if (!currValueText || currValueText.trim() === "") {
    return values;
  }

  const lines = currValueText.split("\n");
  let inCurrValueSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "CURR VALUE") {
      inCurrValueSection = true;
      continue;
    }

    if (inCurrValueSection) {
      if (trimmed.includes("R1 :S")) {
        const match = trimmed.match(/R1\s*:S\s+(-?\d+)/);
        if (match) {
          values.R1.S = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*L\s+(-?\d+)/)) {
        const match = trimmed.match(/L\s+(-?\d+)/);
        if (match) {
          values.R1.L = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*U\s+(-?\d+)/)) {
        const match = trimmed.match(/U\s+(-?\d+)/);
        if (match) {
          values.R1.U = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*R\s+(-?\d+)/) && !trimmed.includes("R1")) {
        const match = trimmed.match(/R\s+(-?\d+)/);
        if (match) {
          values.R1.R = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*B\s+(-?\d+)/)) {
        const match = trimmed.match(/B\s+(-?\d+)/);
        if (match) {
          values.R1.B = parseInt(match[1]);
        }
      } else if (trimmed.match(/^\s*T\s+(-?\d+)/)) {
        const match = trimmed.match(/T\s+(-?\d+)/);
        if (match) {
          values.R1.T = parseInt(match[1]);
        }
      } else if (trimmed.startsWith("///INDEX")) {
        break;
      }
    }
  }

  return values;
};

export const extractAbsoluteDataEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): AbsoluteDataEntry[] => {
  const events: AbsoluteDataEntry[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    if (event.includes("org abso")) {
      const currValueText = entry.fields["CURR VALUE"] || entry.rawData || "";
      const parsedValues = parseCurrentValue(currValueText);

      events.push({
        index: entry.index,
        date: entry.date || "",
        groupNumber: entry.fields["GROUP NUMBER"] || "",
        axisNumber: entry.fields["AXIS NUMBER"] || "",
        setValue: entry.fields["SET VALUE"] || "",
        currValue: parsedValues,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
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

export const compareAbsoValues = (entries: AbsoluteDataEntry[]): AxisComparison[] => {
  if (entries.length < 2) return [];

  const latest = entries[0];
  const previous = entries[1];

  const comparisons: AxisComparison[] = [];
  const axes: (keyof R1Values)[] = ["S", "L", "U", "R", "B", "T"];

  axes.forEach((axis) => {
    const newVal = latest.currValue.R1[axis] || 0;
    const oldVal = previous.currValue.R1[axis] || 0;

    const change = newVal - oldVal;
    const changePercent = oldVal !== 0 ? (change / Math.abs(oldVal)) * 100 : 0;

    comparisons.push({
      axis,
      oldValue: oldVal,
      newValue: newVal,
      change,
      changePercent,
    });
  });

  return comparisons;
};

export const calculateAbsoStatistics = (events: AbsoluteDataEntry[]): AbsoStatistics => {
  const changesByAxis: Record<string, number> = {};
  const changedAxesSet = new Set<string>();

  events.forEach((event) => {
    const r1 = event.currValue.R1;
    if (r1.S !== undefined) { changesByAxis["S"] = (changesByAxis["S"] || 0) + 1; changedAxesSet.add("S"); }
    if (r1.L !== undefined) { changesByAxis["L"] = (changesByAxis["L"] || 0) + 1; changedAxesSet.add("L"); }
    if (r1.U !== undefined) { changesByAxis["U"] = (changesByAxis["U"] || 0) + 1; changedAxesSet.add("U"); }
    if (r1.R !== undefined) { changesByAxis["R"] = (changesByAxis["R"] || 0) + 1; changedAxesSet.add("R"); }
    if (r1.B !== undefined) { changesByAxis["B"] = (changesByAxis["B"] || 0) + 1; changedAxesSet.add("B"); }
    if (r1.T !== undefined) { changesByAxis["T"] = (changesByAxis["T"] || 0) + 1; changedAxesSet.add("T"); }
  });

  return {
    totalAbsoEvents: events.length,
    axisChanges: Object.values(changesByAxis).reduce((a, b) => a + b, 0),
    changedAxes: Array.from(changedAxesSet),
    lastChangeDate: events.length > 0 ? events[0].date : undefined,
    changesByAxis,
  };
};
