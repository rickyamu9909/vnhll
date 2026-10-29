/** 允许持续上报的订单状态（真正开关看 trackShareOn，由「前往提货」打开） */
export const TRACKING_STATUSES = ["PENDING_EXECUTION", "IN_TRANSIT", "MATCHED"] as const;

const ENDED_STATUSES = ["DELIVERED", "COMPLETED", "CANCELLED", "FAILED", "REJECTED"];

/** 点击这些节点后开启 / 保持轨迹上报 */
export const TRACK_START_STAGES = ["going_pickup", "picked", "transit"] as const;

export type TrackFreshness = "live" | "off" | "ended";

/** 该状态下是否「允许」上报（不等于已开启；开启以 trackShareOn 为准） */
export function shareOnForStatus(status: string) {
  return (TRACKING_STATUSES as readonly string[]).includes(status);
}

/** 节点是否应打开轨迹上报（前往提货及之后履约节点） */
export function stageEnablesTracking(stageKey: string) {
  return (TRACK_START_STAGES as readonly string[]).includes(stageKey);
}

/**
 * 上报展示状态：开启即「上报中」，不再用「3 分钟无点 = 失联」。
 * 客户端应持续上报，直到已送达 / 结束。
 */
export function trackFreshness(status: string, shareOn: boolean, _recordedAt?: Date | string | null, _now = Date.now()): TrackFreshness {
  if (ENDED_STATUSES.includes(status)) return "ended";
  if (shareOn && shareOnForStatus(status)) return "live";
  return "off";
}

export function validCoord(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: Math.round(latitude * 1e6) / 1e6, lng: Math.round(longitude * 1e6) / 1e6 };
}

/** 速度仅作展示字段，不作为是否上报的条件；非法值记 null */
export function cleanSpeed(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0) return null;
  return Math.round(speed);
}

export function cleanStatusText(value: unknown) {
  const text = String(value || "").trim().slice(0, 40);
  return text || "运输中";
}

export function cleanRecordedAt(value: unknown, now = Date.now()) {
  const time = new Date(String(value || "")).getTime();
  if (!Number.isFinite(time)) return new Date(now);
  if (time > now + 2 * 60 * 1000) return new Date(now);
  if (now - time > 24 * 60 * 60 * 1000) return null;
  return new Date(time);
}
