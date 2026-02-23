import { LogEntry } from "../models/log-content";
import { TeachingEvent, TeachingStatistics } from "../models/teaching-event-dto";

export const extractTeachingEvents = (logEntries: LogEntry[], controllerId?: string, controllerName?: string): TeachingEvent[] => {
  const events: TeachingEvent[] = [];

  logEntries.forEach((entry) => {
    const event = entry.event?.toLowerCase() || "";

    if (event.includes("job edit(p. mod)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "POINT_MODIFICATION",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Point modified in ${entry.fields["FILE NAME"]} at line ${entry.fields["LINE"]}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("job edit(ins)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "INSTRUCTION_INSERT",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Instruction inserted: ${entry.fields["AFTER EDIT"] || "Unknown"}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("job edit(del)")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "INSTRUCTION_DELETE",
        fileName: entry.fields["FILE NAME"],
        lineNumber: entry.fields["LINE"],
        details: `Instruction deleted: ${entry.fields["DELETED LINE"] || "Unknown"}`,
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    } else if (event.includes("teach mode")) {
      events.push({
        index: entry.index,
        date: entry.date || "",
        type: "TEACH_MODE",
        details: "Robot entered teach mode",
        rawEntry: entry.rawData,
        controllerId,
        controllerName,
      });
    }
  });

  return events.sort((a, b) => a.index - b.index);
};

export const calculateTeachingStatistics = (events: TeachingEvent[]): TeachingStatistics => {
  const fileModifications: {
    [key: string]: {
      count: number;
      lastDate: string;
      lastEvent: TeachingEvent;
    };
  } = {};

  events.forEach((event) => {
    if (event.fileName) {
      if (!fileModifications[event.fileName]) {
        fileModifications[event.fileName] = {
          count: 0,
          lastDate: event.date,
          lastEvent: event,
        };
      }
      fileModifications[event.fileName].count += 1;

      if (event.index < fileModifications[event.fileName].lastEvent.index) {
        fileModifications[event.fileName].lastDate = event.date;
        fileModifications[event.fileName].lastEvent = event;
      }
    }
  });

  const mostModifiedFiles = Object.entries(fileModifications)
    .map(([fileName, data]) => ({
      fileName,
      count: data.count,
      lastTeachingDate: data.lastDate,
      lastEvent: data.lastEvent,
    }))
    .sort((a, b) => {
      const dateComparison = new Date(b.lastTeachingDate).getTime() - new Date(a.lastTeachingDate).getTime();
      if (dateComparison !== 0) return dateComparison;
      return b.count - a.count;
    })
    .slice(0, 5);

  return {
    totalTeachingEvents: events.length,
    pointModifications: events.filter((e) => e.type === "POINT_MODIFICATION").length,
    instructionInserts: events.filter((e) => e.type === "INSTRUCTION_INSERT").length,
    instructionDeletes: events.filter((e) => e.type === "INSTRUCTION_DELETE").length,
    teachModeActivations: events.filter((e) => e.type === "TEACH_MODE").length,
    lastTeachingDate: events.length > 0 ? events[0].date : undefined,
    mostModifiedFiles,
  };
};
