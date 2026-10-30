/** 司机履约节点（已去掉「待接货」按钮，订单状态本身即为待接货） */
export const DRIVER_STAGES = [
  { key: "going_pickup", label: "前往提货", status: "PENDING_EXECUTION" },
  { key: "picked", label: "已提货", status: "IN_TRANSIT" },
  { key: "transit", label: "运输中", status: "IN_TRANSIT" },
  { key: "delivered", label: "已送达", status: "DELIVERED" },
] as const;

export const DRIVER_ISSUE = { key: "issue", label: "车辆异常" };

export function stageLabel(key?: string | null, t?: (k: string, f?: string) => string) {
  if (!key) return "";
  if (t) return t(`stage.${key}`, key === DRIVER_ISSUE.key ? DRIVER_ISSUE.label : DRIVER_STAGES.find((s) => s.key === key)?.label || key);
  if (key === DRIVER_ISSUE.key) return DRIVER_ISSUE.label;
  return DRIVER_STAGES.find((stage) => stage.key === key)?.label || (key === "wait_pickup" ? "待接货" : "");
}
