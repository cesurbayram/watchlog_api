export interface R1ParsedValues {
  S: number;
  L: number;
  U: number;
  R: number;
  B: number;
  T: number;
}

const AXES = ["S", "L", "U", "R", "B", "T"] as const;

export function parseAbsoDat(content: string): R1ParsedValues {
  const result: R1ParsedValues = { S: 0, L: 0, U: 0, R: 0, B: 0, T: 0 };

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const dataLines = lines.slice(2);

  const allParts = dataLines.flatMap((line) =>
    line.split(",").map((p) => p.trim())
  );

  let partIndex = 0;
  for (const axis of AXES) {
    while (partIndex < allParts.length - 1) {
      const flag = parseInt(allParts[partIndex], 10);
      const value = parseInt(allParts[partIndex + 1], 10) || 0;
      partIndex += 2;
      if (flag === 1) {
        result[axis] = value;
        break;
      }
    }
  }

  return result;
}
