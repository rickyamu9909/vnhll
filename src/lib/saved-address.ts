import { assertOrderRegion, knownProvince } from "@/lib/regions";

export function parseSavedAddress(body: Record<string, unknown>) {
  const province = String(body.province || "").trim();
  const ward = String(body.ward || "").trim();
  const address = String(body.address || "").trim();
  const contact = String(body.contact || "").trim();
  const phone = String(body.phone || "").trim();
  if (!province || !ward || !address || !contact || !phone) {
    throw new Error("请先填好省/市、区/坊/社、详细地址、联系人和电话");
  }
  if (!knownProvince(province)) throw new Error("请从列表选择省/市");
  assertOrderRegion(province, ward, "常用地址");
  const label = (String(body.label || "").trim() || `${province} ${ward}`).slice(0, 40);
  return { label, province, ward, address, contact, phone };
}
