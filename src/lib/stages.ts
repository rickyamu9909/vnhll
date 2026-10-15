export const DRIVER_STAGES = [
  { key: "wait_pickup", label: "待接货", status: "PENDING_EXECUTION" },
  { key: "going_pickup", label: "前往提货", status: "PENDING_EXECUTION" },
  { key: "picked", label: "已提货", status: "IN_TRANSIT" },
  { key: "transit", label: "运输中", status: "IN_TRANSIT" },
  { key: "delivered", label: "已送达", status: "DELIVERED" },
] as const;

export const DRIVER_ISSUE = { key: "issue", label: "车辆异常" };

export function stageLabel(key?: string | null) {
  if (key === DRIVER_ISSUE.key) return DRIVER_ISSUE.label;
  return DRIVER_STAGES.find((stage) => stage.key === key)?.label || "";
}
