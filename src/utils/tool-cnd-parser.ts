export interface ToolTcp {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface ToolCog {
  xg: number;
  yg: number;
  zg: number;
}

export interface ToolInertia {
  ix: number;
  iy: number;
  iz: number;
}

export interface ParsedTool {
  toolNumber: number;
  name: string;
  tcp: ToolTcp;
  cog: ToolCog;
  weight: number;
  inertia: ToolInertia;
}

export interface ParsedToolCnd {
  tools: ParsedTool[];
}

export function parseToolCnd(content: string): ParsedToolCnd {
  const tools: ParsedTool[] = [];
  const lines = content.split("\n").map((l) => l.trim());

  let i = 0;
  while (i < lines.length) {
    const toolMatch = lines[i].match(/^\/\/TOOL\s+(\d+)$/i);
    if (!toolMatch) {
      i++;
      continue;
    }

    const toolNumber = parseInt(toolMatch[1], 10);
    i++;

    let name = "";
    if (i < lines.length && lines[i].startsWith("///NAME")) {
      name = lines[i].replace(/^\/\/\/NAME\s*/i, "").trim();
      i++;
    }

    const tcp = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    if (i < lines.length) {
      const parts = lines[i].split(",").map((p) => parseFloat(p.trim()) || 0);
      if (parts.length >= 6) {
        tcp.x = parts[0];
        tcp.y = parts[1];
        tcp.z = parts[2];
        tcp.rx = parts[3];
        tcp.ry = parts[4];
        tcp.rz = parts[5];
      }
      i++;
    }

    const cog = { xg: 0, yg: 0, zg: 0 };
    if (i < lines.length) {
      const parts = lines[i].split(",").map((p) => parseFloat(p.trim()) || 0);
      if (parts.length >= 3) {
        cog.xg = parts[0];
        cog.yg = parts[1];
        cog.zg = parts[2];
      }
      i++;
    }

    let weight = 0;
    if (i < lines.length) {
      weight = parseFloat(lines[i].trim()) || 0;
      i++;
    }

    const inertia = { ix: 0, iy: 0, iz: 0 };
    if (i < lines.length) {
      const parts = lines[i].split(",").map((p) => parseFloat(p.trim()) || 0);
      if (parts.length >= 3) {
        inertia.ix = parts[0];
        inertia.iy = parts[1];
        inertia.iz = parts[2];
      }
      i++;
    }

    if (i < lines.length && /^\d|^-?\d/.test(lines[i])) {
      i++;
    }

    tools.push({ toolNumber, name, tcp, cog, weight, inertia });
  }

  return { tools };
}
