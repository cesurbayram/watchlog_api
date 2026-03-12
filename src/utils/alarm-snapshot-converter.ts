import { AlarmCategory } from "./almhist-dat-parser";

export type SystemAlarmType = "MAJOR" | "MINOR" | "USER" | "SYSTEM" | "OFFLINE";

export interface SystemAlarmHistoryItem {
  code: string;
  name: string;
  originDate: string;
  mode: string;
  type: SystemAlarmType;
  controllerId?: string;
}

function categoryToType(cat: AlarmCategory): SystemAlarmType {
  if (cat === "MAJOR") return "MAJOR";
  if (cat === "MINOR") return "MINOR";
  if (cat === "IO_USR") return "USER";
  if (cat === "OFFLINE") return "OFFLINE";
  return "SYSTEM";
}

interface AlarmEntry {
  code: string;
  message: string;
  recordedAt: string;
  mode: string;
}

interface CategoryEntry {
  name: AlarmCategory;
  alarms: AlarmEntry[];
}

export function alarmSnapshotToHistoryItems(
  snapshot: { controllerId?: string; categories?: CategoryEntry[] },
  filterType?: SystemAlarmType
): SystemAlarmHistoryItem[] {
  const items: SystemAlarmHistoryItem[] = [];
  if (!snapshot?.categories) return items;

  for (const cat of snapshot.categories) {
    const type = categoryToType(cat.name);
    if (filterType && type !== filterType) continue;

    for (const a of cat.alarms || []) {
      items.push({
        code: a.code,
        name: a.message,
        originDate: a.recordedAt,
        mode: a.mode,
        type,
        controllerId: snapshot.controllerId,
      });
    }
  }

  return items.sort((a, b) => {
    const da = a.originDate ? new Date(a.originDate.replace(/\//g, "-")).getTime() : 0;
    const db = b.originDate ? new Date(b.originDate.replace(/\//g, "-")).getTime() : 0;
    return db - da;
  });
}
