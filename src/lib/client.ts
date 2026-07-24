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

export function statusLabel(status: string, t: (k: string, f?: string) => string) {
  return t(`status.${status}`, status);
}
