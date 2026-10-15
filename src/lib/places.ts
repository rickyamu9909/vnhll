import raw from "@/data/freight-places.json";

export type FreightPlace = {
  id: string;
  kind: "YARD" | "PORT";
  name: string;
  province: string;
  ward: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export const FREIGHT_PLACES = raw as FreightPlace[];

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
