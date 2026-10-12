export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; message?: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({ ok: false, message: "网络错误" }));
  return json;
}

export function vehicleLabel(type: string, t: (k: string, f?: string) => string) {
  return t(`vehicle.${type}`, type);
}

const STATUS_ZH: Record<string, string> = {
  OPEN: "匹配中",
  LOCKED: "待平台审核",
  PENDING_CONFIRM: "待确认报价",
  PENDING_AUDIT: "待平台审核",
  PENDING_EXECUTION: "待执行",
  IN_TRANSIT: "运输中",
  DELIVERED: "已送达",
  COMPLETED: "已完成",
  FAILED: "已流标",
  CANCELLED: "已取消",
  REJECTED: "已拒绝",
  PENDING_REVIEW: "待审核",
  BIDDING: "竞价中",
  MATCHED: "已接单",
};

export function statusLabel(status: string, t: (k: string, f?: string) => string) {
  return t(`status.${status}`, STATUS_ZH[status] || status);
}
