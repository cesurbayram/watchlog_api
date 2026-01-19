export interface RobotInfo {
  name: string;
  model: string;
  servoPowerTime?: string;
  playbackTime?: string;
  movingTime?: string;
}

export interface PositionerInfo {
  name: string;
  model: string;
  servoPowerTime?: string;
  playbackTime?: string;
  movingTime?: string;
}

export interface ParsedSystemInfo {
  systemNo?: string;
  version?: string;
  paramNo?: string;
  application?: string;
  language?: string;
  robotModel?: string;
  robotName?: string;
  robots: RobotInfo[];
  positioners: PositionerInfo[];
}

export const parseSystemFile = (content: string): ParsedSystemInfo => {
  const lines = content.split("\n");
  const result: ParsedSystemInfo = {
    robots: [],
    positioners: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("//SYSTEM NO")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.systemNo = match[1].trim();
        result.version = match[1].trim();
      }
    }

    if (trimmedLine.startsWith("//PARAM")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.paramNo = match[1].trim();
      }
    }

    if (trimmedLine.startsWith("//APPLI")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.application = match[1].trim();
      }
    }

    if (trimmedLine.startsWith("//LANGUAGE")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.language = match[1].trim();
      }
    }

    if (trimmedLine.startsWith("//ROBOT NAME")) {
      let j = i + 1;
      while (j < lines.length) {
        const robotLine = lines[j].trim();
        if (robotLine.startsWith("//") || !robotLine) break;

        if (robotLine.includes(":")) {
          const parts = robotLine.split(":");
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const modelPart = parts[1].trim();
            const modelMatch = modelPart.match(/^([^\s]+(?:\([^)]+\))?)/);

            if (modelMatch) {
              const model = modelMatch[1];

              if (name.startsWith("R")) {
                result.robots.push({ name, model });
                if (!result.robotName) {
                  result.robotName = name;
                  result.robotModel = model;
                }
              } else if (name.startsWith("S")) {
                result.positioners.push({ name, model });
              }
            }
          }
        }
        j++;
      }
    }

    if (trimmedLine.startsWith("//SERVO POWER")) {
      let j = i + 1;
      while (j < lines.length) {
        const powerLine = lines[j].trim();
        if (powerLine.startsWith("//") || !powerLine) break;

        if (powerLine.includes(":") && !powerLine.startsWith("TOTAL")) {
          const parts = powerLine.split(":");
          const name = parts[0].trim();
          const timeMatch = powerLine.match(/,(.+)$/);

          if (timeMatch) {
            const time = timeMatch[1].trim();
            const robot = result.robots.find((r) => r.name === name);
            const positioner = result.positioners.find((p) => p.name === name);

            if (robot) robot.servoPowerTime = time;
            if (positioner) positioner.servoPowerTime = time;
          }
        }
        j++;
      }
    }

    if (trimmedLine.startsWith("//PLAYBACK TIME")) {
      let j = i + 1;
      while (j < lines.length) {
        const playLine = lines[j].trim();
        if (playLine.startsWith("//") || !playLine) break;

        if (playLine.includes(":") && !playLine.startsWith("TOTAL")) {
          const parts = playLine.split(":");
          const name = parts[0].trim();
          const timeMatch = playLine.match(/,(.+)$/);

          if (timeMatch) {
            const time = timeMatch[1].trim();
            const robot = result.robots.find((r) => r.name === name);
            const positioner = result.positioners.find((p) => p.name === name);

            if (robot) robot.playbackTime = time;
            if (positioner) positioner.playbackTime = time;
          }
        }
        j++;
      }
    }

    if (trimmedLine.startsWith("//MOVING TIME")) {
      let j = i + 1;
      while (j < lines.length) {
        const moveLine = lines[j].trim();
        if (moveLine.startsWith("//") || !moveLine) break;

        if (moveLine.includes(":") && !moveLine.startsWith("TOTAL")) {
          const parts = moveLine.split(":");
          const name = parts[0].trim();
          const timeMatch = moveLine.match(/,(.+)$/);

          if (timeMatch) {
            const time = timeMatch[1].trim();
            const robot = result.robots.find((r) => r.name === name);
            const positioner = result.positioners.find((p) => p.name === name);

            if (robot) robot.movingTime = time;
            if (positioner) positioner.movingTime = time;
          }
        }
        j++;
      }
    }
  }

  return result;
};

export const formatRobotModel = (robotModel?: string): string => {
  if (!robotModel) return "Unknown";

  const modelMatch = robotModel.match(/([A-Z]+)0*(\d+)/);
  if (modelMatch) {
    const prefix = modelMatch[1];
    const number = modelMatch[2];
    const suffix = robotModel.replace(/[A-Z]+\d+/, "");
    return `${prefix}${number}${suffix}`;
  }

  return robotModel;
};

export const formatApplication = (application?: string): string => {
  if (!application) return "Unknown";

  const appMap: { [key: string]: string } = {
    "ARC WELDING": "ARC",
    HANDLING: "HANDLING",
    "SPOT WELDING": "SPOT",
    GENERAL: "GENERAL",
    PAINT: "PAINT",
  };

  return appMap[application.toUpperCase()] || application;
};
