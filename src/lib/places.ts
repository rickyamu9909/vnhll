export type FreightPlace = {
  id: string;
  kind: "YARD" | "PORT";
  name: string;
  province: string;
  ward: string;
  address: string;
  lat: number;
  lng: number;
};

const HCM = "Thành phố Hồ Chí Minh";
const DONGNAI = "Tỉnh Đồng Nai";
const HAIPHONG = "Thành phố Hải Phòng";
const DANANG = "Thành phố Đà Nẵng";
const GIALAI = "Tỉnh Gia Lai";

export const FREIGHT_PLACES: FreightPlace[] = [
  { id: "port-catlai", kind: "PORT", name: "Cảng Cát Lái", province: HCM, ward: "Phường Cát Lái", address: "Cảng Cát Lái, Đường Nguyễn Thị Định", lat: 10.7636, lng: 106.7858 },
  { id: "port-tanthuan", kind: "PORT", name: "Cảng Tân Thuận", province: HCM, ward: "Phường Tân Thuận", address: "Cảng Tân Thuận", lat: 10.7462, lng: 106.7234 },
  { id: "port-vict", kind: "PORT", name: "Cảng VICT", province: HCM, ward: "Phường Tân Thuận", address: "Cảng VICT, Tân Thuận Đông", lat: 10.7518, lng: 106.7148 },
  { id: "port-hiepphuoc", kind: "PORT", name: "Cảng Hiệp Phước", province: HCM, ward: "Xã Hiệp Phước", address: "Cảng Hiệp Phước", lat: 10.6485, lng: 106.7472 },
  { id: "port-phumy", kind: "PORT", name: "Cảng Phú Mỹ", province: HCM, ward: "Phường Phú Mỹ", address: "Cảng Phú Mỹ", lat: 10.5834, lng: 107.0276 },
  { id: "port-caimep", kind: "PORT", name: "Cảng Cái Mép", province: HCM, ward: "Phường Tân Phước", address: "Cảng Cái Mép - Thị Vải", lat: 10.5398, lng: 107.0312 },
  { id: "port-tancang-cm", kind: "PORT", name: "Tân Cảng Cái Mép", province: HCM, ward: "Phường Tân Phước", address: "Tân Cảng Cái Mép", lat: 10.548, lng: 107.022 },
  { id: "port-gemalink", kind: "PORT", name: "Cảng Gemalink", province: HCM, ward: "Phường Phú Mỹ", address: "Cảng Gemalink, Cái Mép", lat: 10.532, lng: 107.045 },
  { id: "port-vungtau", kind: "PORT", name: "Cảng Vũng Tàu", province: HCM, ward: "Phường Vũng Tàu", address: "Cảng Vũng Tàu", lat: 10.346, lng: 107.072 },
  { id: "port-haiphong", kind: "PORT", name: "Cảng Hải Phòng", province: HAIPHONG, ward: "Phường Hải An", address: "Cảng Hải Phòng", lat: 20.856, lng: 106.722 },
  { id: "port-danang", kind: "PORT", name: "Cảng Đà Nẵng", province: DANANG, ward: "Phường Sơn Trà", address: "Cảng Tiên Sa, Đà Nẵng", lat: 16.119, lng: 108.221 },
  { id: "port-quynhon", kind: "PORT", name: "Cảng Quy Nhơn", province: GIALAI, ward: "Phường Quy Nhơn", address: "Cảng Quy Nhơn", lat: 13.766, lng: 109.232 },
  { id: "yard-catlai", kind: "YARD", name: "Depot Cát Lái", province: HCM, ward: "Phường Cát Lái", address: "Depot Cát Lái", lat: 10.7702, lng: 106.7784 },
  { id: "yard-sotrans", kind: "YARD", name: "ICD Sotrans", province: HCM, ward: "Phường Cát Lái", address: "ICD Sotrans, Cát Lái", lat: 10.768, lng: 106.772 },
  { id: "yard-transimex", kind: "YARD", name: "ICD Transimex", province: HCM, ward: "Phường Cát Lái", address: "ICD Transimex, Cát Lái", lat: 10.766, lng: 106.781 },
  { id: "yard-songthan", kind: "YARD", name: "ICD Sóng Thần", province: HCM, ward: "Phường Dĩ An", address: "ICD Tân Cảng Sóng Thần", lat: 10.8985, lng: 106.7648 },
  { id: "yard-longbinh", kind: "YARD", name: "ICD Long Bình", province: DONGNAI, ward: "Phường Long Bình", address: "ICD Tân Cảng Long Bình", lat: 10.8902, lng: 106.851 },
  { id: "yard-phuoclong", kind: "YARD", name: "ICD Phước Long", province: DONGNAI, ward: "Phường Phước Long", address: "ICD Phước Long", lat: 10.905, lng: 106.838 },
  { id: "yard-tanvan", kind: "YARD", name: "ICD Tân Vạn", province: DONGNAI, ward: "Phường Biên Hòa", address: "ICD TBS Tân Vạn", lat: 10.912, lng: 106.812 },
  { id: "yard-phuan", kind: "YARD", name: "ICD Phú An", province: HCM, ward: "Phường Thủ Đức", address: "ICD Phú An, Thủ Đức", lat: 10.849, lng: 106.762 },
];

export function placeById(id: unknown) {
  const key = String(id || "").trim();
  if (!key) return null;
  return FREIGHT_PLACES.find((place) => place.id === key) || null;
}

export function placeFromText(text: string) {
  const query = text.toLowerCase();
  if (query.length < 3) return null;
  return [...FREIGHT_PLACES].sort((a, b) => b.name.length - a.name.length).find((place) => query.includes(place.name.toLowerCase())) || null;
}

export function capacityMatchBlock(status: string | null | undefined) {
  if (!status) return "找不到这条运力，可能已被删除";
  if (status === "MATCHED") return "这条运力已经匹配成功，不能再次发起。请到订单里查看结果";
  if (status === "CLOSED") return "司机已经取消这条运力，所以不能匹配";
  if (status !== "OPEN") return `这条运力当前不可匹配（状态：${status}）`;
  return null;
}
