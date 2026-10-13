import data from "../data/vn-admin.json";

type Province = { n: string; w: string[] };

const PROVINCES = data as Province[];

const ZH: Record<string, string> = {
  "Thành phố Hà Nội": "河内市",
  "Tỉnh Cao Bằng": "高平省",
  "Tỉnh Tuyên Quang": "宣光省",
  "Tỉnh Điện Biên": "奠边省",
  "Tỉnh Lai Châu": "莱州省",
  "Tỉnh Sơn La": "山罗省",
  "Tỉnh Lào Cai": "老街省",
  "Tỉnh Thái Nguyên": "太原省",
  "Tỉnh Lạng Sơn": "谅山省",
  "Tỉnh Quảng Ninh": "广宁省",
  "Tỉnh Bắc Ninh": "北宁省",
  "Tỉnh Phú Thọ": "富寿省",
  "Thành phố Hải Phòng": "海防市",
  "Tỉnh Hưng Yên": "兴安省",
  "Tỉnh Ninh Bình": "宁平省",
  "Tỉnh Thanh Hóa": "清化省",
  "Tỉnh Nghệ An": "义安省",
  "Tỉnh Hà Tĩnh": "河静省",
  "Tỉnh Quảng Trị": "广治省",
  "Thành phố Huế": "顺化市",
  "Thành phố Đà Nẵng": "岘港市",
  "Tỉnh Quảng Ngãi": "广义省",
  "Tỉnh Gia Lai": "嘉莱省",
  "Tỉnh Khánh Hòa": "庆和省",
  "Tỉnh Đắk Lắk": "得乐省",
  "Tỉnh Lâm Đồng": "林同省",
  "Tỉnh Đồng Nai": "同奈省",
  "Thành phố Hồ Chí Minh": "胡志明市",
  "Tỉnh Tây Ninh": "西宁省",
  "Tỉnh Đồng Tháp": "同塔省",
  "Tỉnh Vĩnh Long": "永隆省",
  "Tỉnh An Giang": "安江省",
  "Thành phố Cần Thơ": "芹苴市",
  "Tỉnh Cà Mau": "金瓯省",
};

export function provinceOptions() {
  return PROVINCES.map((p) => ({
    value: p.n,
    label: ZH[p.n] ? `${ZH[p.n]} ${p.n}` : p.n,
  }));
}

export function wardsOf(province?: string | null) {
  if (!province) return [];
  return PROVINCES.find((p) => p.n === province)?.w || [];
}

export function knownProvince(province?: string | null) {
  return PROVINCES.some((p) => p.n === province);
}

/** 已知省/市时，区/坊/社必须属于该省。旧订单里的自由文本省名仍放行。 */
export function assertOrderRegion(province: string, ward: string, label: string) {
  if (!province || !ward) throw new Error(`请选择${label}的省/市和区/坊/社`);
  const hit = PROVINCES.find((p) => p.n === province);
  if (!hit) return;
  if (!hit.w.includes(ward)) throw new Error(`${label}的区/坊/社与省/市不匹配，请重新选择`);
}

export const REGION_COUNTS = {
  provinces: PROVINCES.length,
  wards: PROVINCES.reduce((sum, p) => sum + p.w.length, 0),
};
