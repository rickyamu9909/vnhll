import fs from "node:fs";

const lines = fs.readFileSync(new URL("./yards.tsv", import.meta.url), "utf8").split(/\n/).slice(1);
const yards = new Map();
const ports = new Map();

function add(map, raw) {
  const name = String(raw || "")
    .replace(/&#10;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name === "-" || name === "—") return;
  const key = name.toLocaleLowerCase("vi");
  if (!map.has(key)) map.set(key, name);
}

for (const line of lines) {
  if (!line.trim()) continue;
  const [yard, port] = line.split("\t");
  add(yards, yard);
  add(ports, port);
}

function slug(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const known = {
  "cát lái": [10.7636, 106.7858],
  "depot 5a cát lái": [10.77, 106.778],
  "tân cảng mỹ thủy": [10.768, 106.77],
  "spitc port": [10.752, 106.715],
  "icd phúc long 2": [10.905, 106.838],
  "icd phúc long 3": [10.906, 106.84],
  "icd phước long 01": [10.905, 106.838],
  "icd phước long 3 (icd3)": [10.905, 106.84],
  "sowatco long binh": [10.89, 106.851],
  "cảng bình dương": [10.98, 106.68],
  "sinovnl tân vạn": [10.912, 106.812],
  "tbs tân vạn": [10.912, 106.812],
  "icd tân cảng sóng thần": [10.8985, 106.7648],
  "solog sóng thần": [10.9, 106.77],
  "tân cảng hiệp lực": [10.766, 106.781],
  "cang dong nai": [10.95, 106.82],
};

function row(kind, name) {
  const hit = known[name.toLocaleLowerCase("vi")];
  return {
    id: `${kind === "YARD" ? "yard" : "port"}-${slug(name)}`,
    kind,
    name,
    province: "",
    ward: "",
    address: name,
    lat: hit ? hit[0] : null,
    lng: hit ? hit[1] : null,
  };
}

const places = [
  ...[...yards.values()].sort((a, b) => a.localeCompare(b, "vi")).map((name) => row("YARD", name)),
  ...[...ports.values()].sort((a, b) => a.localeCompare(b, "vi")).map((name) => row("PORT", name)),
];
const ids = new Set();
for (const place of places) {
  let id = place.id;
  let n = 2;
  while (ids.has(id)) id = `${place.id}-${n++}`;
  place.id = id;
  ids.add(id);
}
fs.writeFileSync(new URL("../src/data/freight-places.json", import.meta.url), JSON.stringify(places, null, 2));
console.log("yards", yards.size, "ports", ports.size, "total", places.length);
