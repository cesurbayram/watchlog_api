import { R1Values, AbsoluteDataEntry, AxisComparison, AbsoStatistics } from "../models/abso-event-dto";

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
