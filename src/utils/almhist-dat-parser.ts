export type AlarmCategory = "MAJOR" | "MINOR" | "IO_SYS" | "IO_USR" | "OFFLINE";

export interface ParsedAlarm {
  code: string;
  message: string;
  location: string;
  mode: string;
  programInfo: string;
  recordedAt: string;
  userName: string;
}

export interface ParsedCategory {
  name: AlarmCategory;
  maxCapacity: number;
  currentCount: number;
  alarms: ParsedAlarm[];
}

export interface ParsedAlmhist {
  categories: ParsedCategory[];
}

const CATEGORY_HEADERS: AlarmCategory[] = ["MAJOR", "MINOR", "IO_SYS", "IO_USR", "OFFLINE"];

const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}:\d{2}$/;

function parseAlarmBlock(lines: string[], startIdx: number): { alarm: ParsedAlarm; nextIdx: number } | null {
  if (startIdx >= lines.length) return null;

  const line1 = lines[startIdx].trim();
  if (!line1 || !/^\d+/.test(line1)) return null;

  const parts = line1.split(",").map((p) => p.trim());
  const code = parts[0] || "";
  const message = parts[1] || "";
  const location = parts[2] || "";
  const mode = parts[5] || "";

  let programInfo = "";
  let recordedAt = "";
  let userName = "";
  let dateLineIdx = -1;

  for (let j = startIdx + 1; j < Math.min(startIdx + 15, lines.length); j++) {
    const t = lines[j].trim();
    if (DATE_PATTERN.test(t)) {
      recordedAt = t;
      dateLineIdx = j;
      if (j + 1 < lines.length) {
        const u = lines[j + 1].trim();
        if (u && !DATE_PATTERN.test(u) && !u.startsWith("///")) userName = u;
      }
      break;
    }
    if (t && !t.startsWith("///") && programInfo === "" && /^[A-Za-z0-9_]+/.test(t)) {
      programInfo = t.split(",")[0] || "";
    }
  }

  const alarm: ParsedAlarm = { code, message, location, mode, programInfo, recordedAt, userName };
  const nextIdx = dateLineIdx >= 0 ? dateLineIdx + (userName ? 2 : 1) + 1 : startIdx + 12;

  return { alarm, nextIdx };
}

function parseCategoryBlock(lines: string[], startIdx: number): { category: ParsedCategory; nextIdx: number } | null {
  if (startIdx >= lines.length) return null;

  let categoryName: AlarmCategory | null = null;
  for (const cat of CATEGORY_HEADERS) {
    if (lines[startIdx]?.trim() === `///${cat}`) {
      categoryName = cat;
      break;
    }
  }
  if (!categoryName) return null;

  let maxCapacity = parseInt(lines[startIdx + 1]?.trim() || "0", 10);
  let currentCount = parseInt(lines[startIdx + 2]?.trim() || "0", 10);
  if (!Number.isFinite(maxCapacity)) maxCapacity = 0;
  if (!Number.isFinite(currentCount)) currentCount = 0;
  const alarms: ParsedAlarm[] = [];

  let i = startIdx + 3;
  while (i < lines.length) {
    const trimmed = lines[i]?.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("///")) break;

    const result = parseAlarmBlock(lines, i);
    if (result) {
      alarms.push(result.alarm);
      i = result.nextIdx;
    } else {
      i++;
    }
  }

  const category: ParsedCategory = { name: categoryName, maxCapacity, currentCount, alarms };
  return { category, nextIdx: i };
}

export function parseAlmhistDat(content: string): ParsedAlmhist {
  const categories: ParsedCategory[] = [];
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]?.trim() || "";
    if (line.startsWith("///") && CATEGORY_HEADERS.some((c) => line === `///${c}`)) {
      const result = parseCategoryBlock(lines, i);
      if (result) {
        categories.push(result.category);
        i = result.nextIdx;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return { categories };
}
