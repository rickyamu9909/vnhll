import { prisma } from "./prisma";
import { UI_TEXT } from "./ui-text";

export type Locale = "zh" | "vi";

export async function getTranslationsMap(locale: Locale = "zh") {
  const map: Record<string, string> = { ...(UI_TEXT[locale] || {}) };
  const rows = await prisma.translation.findMany();
  for (const row of rows) {
    const val = locale === "vi" ? row.vi : row.zh;
    if (val) map[row.key] = val;
  }
  return map;
}

/** 把代码内 UI_TEXT 全量写入语言包表（缺 key 补齐；已有行不覆盖非空人工校对） */
export async function syncUiTextPack(overwriteEmptyOnly = true) {
  const zh = UI_TEXT.zh || {};
  const vi = UI_TEXT.vi || {};
  const keys = Array.from(new Set([...Object.keys(zh), ...Object.keys(vi)]));
  let upserted = 0;
  for (const key of keys) {
    const groupName = key.includes(".") ? key.split(".")[0] : "common";
    const zhVal = zh[key] || "";
    const viVal = vi[key] || "";
    const existing = await prisma.translation.findUnique({ where: { key } });
    if (!existing) {
      await prisma.translation.create({ data: { key, zh: zhVal, vi: viVal, groupName } });
      upserted += 1;
      continue;
    }
    const nextZh = overwriteEmptyOnly && existing.zh ? existing.zh : zhVal || existing.zh;
    const nextVi = overwriteEmptyOnly && existing.vi ? existing.vi : viVal || existing.vi;
    if (nextZh !== existing.zh || nextVi !== existing.vi) {
      await prisma.translation.update({ where: { key }, data: { zh: nextZh, vi: nextVi, groupName } });
      upserted += 1;
    }
  }
  return { keys: keys.length, upserted };
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
