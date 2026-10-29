import { OrderStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { routePolyline } from "./geo";
import { TRACK_START_STAGES, cleanRecordedAt, cleanSpeed, cleanStatusText, shareOnForStatus, trackFreshness, validCoord } from "./track";

const OPEN_STATUSES: OrderStatus[] = [OrderStatus.PENDING_EXECUTION, OrderStatus.IN_TRANSIT, OrderStatus.MATCHED];
const ACTIVE_STAGES = [...TRACK_START_STAGES];

/** 关掉历史误开的上报：未点前往提货 / 已结束状态 */
export async function cleanupStaleTrackShare(userId: string) {
  await prisma.order.updateMany({
    where: {
      trackShareOn: true,
      OR: [{ assignedToUserId: userId }, { assignedToUserId: null, acceptedByUserId: userId }],
      AND: [
        {
          OR: [
            { status: { notIn: OPEN_STATUSES } },
            { driverStage: null },
            { driverStage: { notIn: [...ACTIVE_STAGES, "issue"] } },
          ],
        },
      ],
    },
    data: { trackShareOn: false },
  });
}

/** 仅「前往提货」及之后履约节点，且 trackShareOn，才出现在顶部横幅 */
export async function activeTrackOrders(userId: string) {
  await cleanupStaleTrackShare(userId);
  return prisma.order.findMany({
    where: {
      trackShareOn: true,
      status: { in: OPEN_STATUSES },
      driverStage: { in: [...ACTIVE_STAGES, "issue"] },
      OR: [{ assignedToUserId: userId }, { assignedToUserId: null, acceptedByUserId: userId }],
    },
    select: { id: true, orderNo: true, status: true, driverStage: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function saveTrackReports(
  userId: string,
  reports: Array<{ orderId?: unknown; lat?: unknown; lng?: unknown; speedKmh?: unknown; statusText?: unknown; recordedAt?: unknown }>
) {
  let saved = 0;
  const rejected: string[] = [];
  for (const report of reports.slice(0, 50)) {
    const orderId = String(report.orderId || "");
    const coord = validCoord(report.lat, report.lng);
    const recordedAt = cleanRecordedAt(report.recordedAt);
    if (!orderId || !coord || !recordedAt) {
      rejected.push(orderId || "bad-point");
      continue;
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, trackShareOn: true, driverStage: true, acceptedByUserId: true, assignedToUserId: true },
    });
    const owner = order?.assignedToUserId || order?.acceptedByUserId;
    const stageOk = !!order?.driverStage && ([...ACTIVE_STAGES, "issue"] as string[]).includes(order.driverStage);
    if (!order || owner !== userId || !order.trackShareOn || !shareOnForStatus(order.status) || !stageOk) {
      rejected.push(orderId);
      continue;
    }
    const duplicate = await prisma.orderTrackPoint.findFirst({
      where: {
        orderId,
        recordedAt: { gte: new Date(recordedAt.getTime() - 5000), lte: new Date(recordedAt.getTime() + 5000) },
      },
      select: { id: true },
    });
    if (duplicate) continue;
    await prisma.orderTrackPoint.create({
      data: {
        orderId,
        lat: coord.lat,
        lng: coord.lng,
        speedKmh: cleanSpeed(report.speedKmh),
        statusText: cleanStatusText(report.statusText),
        recordedAt,
      },
    });
    saved += 1;
  }
  return { saved, rejected };
}

export async function readOrderTrack(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      status: true,
      trackShareOn: true,
      driverStage: true,
      pickupAddress: true,
      deliveryAddress: true,
      originLat: true,
      originLng: true,
      destLat: true,
      destLng: true,
      originCity: true,
      destCity: true,
    },
  });
  if (!order) return null;
  const points = await prisma.orderTrackPoint.findMany({
    where: { orderId },
    orderBy: { recordedAt: "desc" },
    take: 500,
    select: { lat: true, lng: true, speedKmh: true, statusText: true, recordedAt: true },
  });
  points.reverse();
  const latest = points[points.length - 1] || null;
  const shareOn = !!order.trackShareOn && shareOnForStatus(order.status);
  const origin = order.originLat != null && order.originLng != null ? { lat: order.originLat, lng: order.originLng } : null;
  const dest = order.destLat != null && order.destLng != null ? { lat: order.destLat, lng: order.destLng } : null;
  const navPolyline = origin && dest ? await routePolyline(origin, dest) : null;
  return {
    orderNo: order.orderNo,
    status: order.status,
    shareOn,
    driverStage: order.driverStage,
    freshness: trackFreshness(order.status, shareOn, latest?.recordedAt || null),
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    originLabel: order.originCity || order.pickupAddress,
    destLabel: order.destCity || order.deliveryAddress,
    origin,
    dest,
    navPolyline,
    navSource: navPolyline?.length ? "osrm" : null,
    latest: latest
      ? { ...latest, recordedAt: latest.recordedAt.toISOString(), speedKmh: latest.speedKmh }
      : null,
    points: points.map((point) => ({ ...point, recordedAt: point.recordedAt.toISOString() })),
  };
}
