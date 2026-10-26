import fs from "node:fs";

const path = new URL("../src/data/freight-places.json", import.meta.url);
const places = JSON.parse(fs.readFileSync(path, "utf8"));

const HCMC = "Thành phố Hồ Chí Minh";
const DONG_NAI = "Tỉnh Đồng Nai";
const BINH_DUONG = "Tỉnh Bình Dương";
const BRVT = "Thành phố Hồ Chí Minh"; // 合并后归入 HCMC 名录场景，坐标仍用南部港区

const hubs = [
  { re: /cát lái|cat lai|cátlai/i, lat: 10.7636, lng: 106.7858, province: HCMC, ward: "Phường Cát Lái" },
  { re: /mỹ thủy|my thuy/i, lat: 10.768, lng: 106.77, province: HCMC, ward: "Phường Cát Lái" },
  { re: /spitc|tân thuận|tan thuan/i, lat: 10.752, lng: 106.715, province: HCMC, ward: "Phường Tân Thuận" },
  { re: /phúc long|phuoc long|phước long/i, lat: 10.905, lng: 106.838, province: DONG_NAI, ward: "Phường Phước Long" },
  { re: /sóng thần|song than|solog/i, lat: 10.8985, lng: 106.7648, province: BINH_DUONG, ward: "" },
  { re: /long binh|long bình|sowatco/i, lat: 10.89, lng: 106.851, province: DONG_NAI, ward: "Phường Long Bình" },
  { re: /tân vạn|tan van|sinovnl|tbs/i, lat: 10.912, lng: 106.812, province: BINH_DUONG, ward: "" },
  { re: /bình dương|binh duong/i, lat: 10.98, lng: 106.68, province: BINH_DUONG, ward: "" },
  { re: /đồng nai|dong nai/i, lat: 10.95, lng: 106.82, province: DONG_NAI, ward: "" },
  { re: /cái mép|cai mep|thị vải|thi vai|gemalink|tctt/i, lat: 10.52, lng: 107.02, province: BRVT, ward: "Phường Phú Mỹ" },
  { re: /hiệp lực|hiep luc/i, lat: 10.766, lng: 106.781, province: HCMC, ward: "Phường Cát Lái" },
  { re: /nhà bè|nha be|hiệp phước|hiep phuoc/i, lat: 10.65, lng: 106.75, province: HCMC, ward: "Xã Hiệp Phước" },
  { re: /thủ đức|thu duc|phước long/i, lat: 10.85, lng: 106.77, province: HCMC, ward: "Phường Thủ Đức" },
  { re: /dĩ an|di an/i, lat: 10.905, lng: 106.77, province: HCMC, ward: "Phường Dĩ An" },
  { re: /topasia|depot/i, lat: 10.77, lng: 106.78, province: HCMC, ward: "Phường Cát Lái" },
  { re: /icd/i, lat: 10.9, lng: 106.82, province: DONG_NAI, ward: "" },
  { re: /port|cảng|cang/i, lat: 10.76, lng: 106.78, province: HCMC, ward: "" },
];

let filled = 0;
for (const place of places) {
  const hit = hubs.find((h) => h.re.test(place.name));
  if (!hit) continue;
  if (place.lat == null) {
    place.lat = hit.lat;
    place.lng = hit.lng;
    filled++;
  }
  if (!place.province) place.province = hit.province;
  if (!place.ward && hit.ward) place.ward = hit.ward;
}

fs.writeFileSync(path, JSON.stringify(places, null, 2));
const withCoord = places.filter((p) => p.lat != null).length;
console.log(`enriched coords now ${withCoord}/${places.length} (+${filled} filled)`);
