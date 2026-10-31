import fs from "fs";

const path = "src/lib/ui-text.ts";
let src = fs.readFileSync(path, "utf8");

function dedupeObjectLiteral(src, startIdx) {
  // startIdx points at '{' of object
  let i = startIdx + 1;
  let depth = 1;
  const entries = []; // {key, fullMatch, start, end}
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && ch === '"') {
      // parse "key": "value",
      const keyStart = i;
      i++;
      let key = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") {
          key += src[i] + src[i + 1];
          i += 2;
          continue;
        }
        key += src[i++];
      }
      i++; // closing "
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== ":") continue;
      i++;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== '"') {
        // skip non-string values
        continue;
      }
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === ",") i++;
      const end = i;
      entries.push({ key, start: keyStart, end });
      continue;
    }
    i++;
  }
  const endIdx = i; // position of closing }
  const seen = new Set();
  const remove = [];
  for (const e of entries) {
    if (seen.has(e.key)) remove.push(e);
    else seen.add(e.key);
  }
  // remove from end so indices stay valid
  remove.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of remove) {
    // also remove leading whitespace/newline before entry
    let s = e.start;
    while (s > 0 && (out[s - 1] === " " || out[s - 1] === "\t")) s--;
    if (out[s - 1] === "\n") s--;
    out = out.slice(0, s) + out.slice(e.end);
  }
  return { out, removed: remove.map((r) => r.key), endIdx };
}

const zhStart = src.indexOf("zh: {") + 4;
const zhBrace = src.indexOf("{", zhStart);
const r1 = dedupeObjectLiteral(src, zhBrace);
src = r1.out;
console.log("zh removed", r1.removed);

const viStart = src.indexOf("vi: {") + 4;
const viBrace = src.indexOf("{", viStart);
const r2 = dedupeObjectLiteral(src, viBrace);
src = r2.out;
console.log("vi removed", r2.removed);

fs.writeFileSync(path, src);
console.log("done");
