export const TRACKING_STATUSES = ["PENDING_EXECUTION", "IN_TRANSIT", "MATCHED"] as const;

const ENDED_STATUSES = ["DELIVERED", "COMPLETED", "CANCELLED", "FAILED", "REJECTED"];

export type TrackFreshness = "live" | "lost" | "off" | "ended";

export function shareOnForStatus(status: string) {
  return (TRACKING_STATUSES as readonly string[]).includes(status);
}

export function trackFreshness(status: string, shareOn: boolean, recordedAt: Date | string | null, now = Date.now()): TrackFreshness {
  if (ENDED_STATUSES.includes(status)) return "ended";
  if (!shareOn && !shareOnForStatus(status)) return "off";
  const time = recordedAt ? new Date(recordedAt).getTime() : 0;
  if (!time || now - time > 3 * 60 * 1000) return "lost";
  return "live";
}

export function validCoord(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: Math.round(latitude * 1e6) / 1e6, lng: Math.round(longitude * 1e6) / 1e6 };
}

export function cleanSpeed(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0) return null;
  return Math.round(Math.min(speed, 200));
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
