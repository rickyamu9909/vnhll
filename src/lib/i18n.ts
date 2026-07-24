import { prisma } from "./prisma";

export type Locale = "zh" | "vi";

export async function getTranslationsMap(locale: Locale = "zh") {
  const rows = await prisma.translation.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = locale === "vi" ? row.vi : row.zh;
  }
  return map;
}

export function t(dict: Record<string, string>, key: string, fallback?: string) {
  return dict[key] || fallback || key;
}

export function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const keyIdx = headers.indexOf("key");
  const zhIdx = headers.indexOf("zh");
  const viIdx = headers.indexOf("vi");
  const groupIdx = headers.indexOf("group");

  if (keyIdx < 0 || zhIdx < 0 || viIdx < 0) {
    throw new Error("CSV headers must include: key,zh,vi[,group]");
  }

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return {
      key: cols[keyIdx]?.trim(),
      zh: cols[zhIdx]?.trim() || "",
      vi: cols[viIdx]?.trim() || "",
      groupName: (groupIdx >= 0 ? cols[groupIdx]?.trim() : "") || "common",
    };
  }).filter((r) => r.key);
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function toCsv(rows: Array<{ key: string; zh: string; vi: string; groupName: string }>) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = ["key,zh,vi,group"];
  for (const r of rows) {
    lines.push([escape(r.key), escape(r.zh), escape(r.vi), escape(r.groupName)].join(","));
  }
  return lines.join("\n");
}
