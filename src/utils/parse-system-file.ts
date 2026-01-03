/**
 * Parse system.sys file content to extract robot information
 */

export interface RobotInfo {
  name: string; // R1, R2, etc.
  model: string; // MA1440/MH12-A0*(MA1440)
  servoPowerTime?: string;
  playbackTime?: string;
  movingTime?: string;
}

export interface PositionerInfo {
  name: string; // S1, S2, S3, etc.
  model: string; // TURN-1, etc.
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

/**
 * Parses SYSTEM.SYS file content and extracts key information
 * @param content - The raw content of SYSTEM.SYS file
 * @returns Parsed system information
 */
export const parseSystemFile = (content: string): ParsedSystemInfo => {
  const lines = content.split("\n");
  const result: ParsedSystemInfo = {
    robots: [],
    positioners: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Parse SYSTEM NO (e.g., "//SYSTEM NO : DS4.42.00A(JP/US)-14")
    if (trimmedLine.startsWith("//SYSTEM NO")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.systemNo = match[1].trim();
        result.version = match[1].trim(); // Use systemNo as version
      }
    }

    // Parse PARAM NO (e.g., "//PARAM  NO : 4.34")
    if (trimmedLine.startsWith("//PARAM")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.paramNo = match[1].trim();
      }
    }

    // Parse APPLI (e.g., "//APPLI     : ARC WELDING")
    if (trimmedLine.startsWith("//APPLI")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.application = match[1].trim();
      }
    }

    // Parse LANGUAGE (e.g., "//LANGUAGE  :  4.42-14-00, 4.42-14-00")
    if (trimmedLine.startsWith("//LANGUAGE")) {
      const match = trimmedLine.match(/:\s*(.+)/);
      if (match) {
        result.language = match[1].trim();
      }
    }

    // Parse ROBOT NAME section (e.g., "R1 : 1-06VX8-A0*(GP8)  0011_1111")
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

    // Parse SERVO POWER times
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

    // Parse PLAYBACK TIME
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

    // Parse MOVING TIME
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

/**
 * Format robot model for display
 * @param robotModel - Raw robot model string (e.g., "MA01400-B0*")
 * @returns Formatted model string (e.g., "MA1440/MH12-A0*(MA1440)")
 */
export const formatRobotModel = (robotModel?: string): string => {
  if (!robotModel) return "Unknown";

  // Extract base model number (e.g., MA01400 -> MA1440)
  const modelMatch = robotModel.match(/([A-Z]+)0*(\d+)/);
  if (modelMatch) {
    const prefix = modelMatch[1];
    const number = modelMatch[2];
    const suffix = robotModel.replace(/[A-Z]+\d+/, "");
    return `${prefix}${number}${suffix}`;
  }

  return robotModel;
};

/**
 * Get application display name
 * @param application - Raw application string
 * @returns Formatted application name
 */
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
