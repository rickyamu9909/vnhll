import {
  CargoType,
  MatchPath,
  NegotiationStatus,
  OrderStatus,
  PackagingType,
  Prisma,
  VehicleType,
} from "@prisma/client";
import { prisma } from "./prisma";
import { calcByBps, serializeMoney, toBigIntMoney } from "./money";
import { genOrderNo } from "./order";
import { assertOrderRegion } from "./regions";
import { geocode, routeEstimate } from "./geo";
import { volumeFromItems } from "./order-form";
import { scoreRouteFit, SUGGEST_MIN_SCORE } from "./route-score";
import { DRIVER_ISSUE, DRIVER_STAGES } from "./stages";
import { shareOnForStatus } from "./track";
import { capacityMatchBlock, placeById, placeFromText } from "./places";

export type CargoItemInput = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  quantity: number;
};

export async function getConfig() {
  return prisma.systemConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export async function logOp(actorId: string | null, action: string, targetType: string, targetId: string | null, note?: string) {
  await prisma.operationLog.create({
    data: { actorId, action, targetType, targetId, note: note || null },
  });
}

export async function notify(userId: string, title: string, body: string) {
  await prisma.notification.create({ data: { userId, title, body } });
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 3600 * 1000);
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

export function buildDeadlines(now: Date, pickupAt: Date, cfg: { waitMatchHours: number; bidLeadHours: number }) {
  const wait = addHours(now, cfg.waitMatchHours);
  const bid = addHours(pickupAt, -cfg.bidLeadHours);
  return { waitDeadline: wait, bidDeadline: bid };
}

function moneyFields(price: bigint, bps: number) {
  const { platformFeeVnd, driverIncomeVnd } = calcByBps(price, bps);
  return { dealPriceVnd: price, platformFeeVnd, driverIncomeVnd };
}

export function parseOrderBody(body: Record<string, unknown>) {
  const originContact = String(body.originContact || body.pickupContact || "").trim();
  const originPhone = String(body.originPhone || body.pickupPhone || "").trim();
  const destContact = String(body.destContact || body.deliveryContact || "").trim();
  const destPhone = String(body.destPhone || body.deliveryPhone || "").trim();
  let originAddress = String(body.originAddress || body.pickupAddress || "").trim();
  let destAddress = String(body.destAddress || body.deliveryAddress || "").trim();
  if (!originContact || !originPhone || !destContact || !destPhone) {
    throw new Error("起运和目的联系人、电话均为必填");
  }
  let originProvince = String(body.originProvince || "").trim();
  let originCity = String(body.originCity || "").trim();
  let destProvince = String(body.destProvince || "").trim();
  let destCity = String(body.destCity || "").trim();
  const originPlace = placeById(body.originPlaceId);
  const destPlace = placeById(body.destPlaceId);
  let originLat: number | null = null;
  let originLng: number | null = null;
  let destLat: number | null = null;
  let destLng: number | null = null;
  if (originPlace) {
    originProvince = originProvince || originPlace.province;
    originCity = originCity || originPlace.ward;
    originAddress = originAddress || originPlace.address;
    originLat = originPlace.lat;
    originLng = originPlace.lng;
  }
  if (destPlace) {
    destProvince = destProvince || destPlace.province;
    destCity = destCity || destPlace.ward;
    destAddress = destAddress || destPlace.address;
    destLat = destPlace.lat;
    destLng = destPlace.lng;
  }
  if (originProvince && originCity) assertOrderRegion(originProvince, originCity, "起运");
  if (destProvince && destCity) assertOrderRegion(destProvince, destCity, "目的");
  const rawItems = Array.isArray(body.cargoItems) ? (body.cargoItems as CargoItemInput[]) : [];
  const items: CargoItemInput[] = [];
  for (const it of rawItems) {
    const blank = !it.lengthCm && !it.widthCm && !it.heightCm;
    if (blank) continue;
    const lengthCm = Number(it.lengthCm);
    const widthCm = Number(it.widthCm);
    const heightCm = Number(it.heightCm);
    if (!lengthCm || !widthCm || !heightCm) throw new Error("尺寸请填写完整");
    items.push({ lengthCm, widthCm, heightCm, quantity: Number(it.quantity) || 1 });
  }
  const weightRaw = body.weightTons;
  const weightTons = weightRaw === undefined || weightRaw === null || weightRaw === "" ? 0 : Number(weightRaw);
  if (!Number.isFinite(weightTons) || weightTons < 0) throw new Error("重量格式不正确");
  const pickupAt = body.pickupAt ? new Date(String(body.pickupAt)) : addHours(new Date(), 24);
  const etaAt = body.etaAt ? new Date(String(body.etaAt)) : null;
  if (Number.isNaN(pickupAt.getTime()) || (body.etaAt && etaAt && Number.isNaN(etaAt.getTime()))) {
    throw new Error("时间格式不正确");
  }
  const targetRaw = body.targetPriceVnd;
  const targetPriceVnd =
    targetRaw === null || targetRaw === undefined || targetRaw === "" ? null : toBigIntMoney(targetRaw as number | string);
  return {
    originProvince,
    originCity,
    originAddress,
    originContact,
    originPhone,
    destProvince,
    destCity,
    destAddress,
    destContact,
    destPhone,
    cargoType: (body.cargoType || "GENERAL") as CargoType,
    packaging: (body.packaging || "CARTON") as PackagingType,
    vehicleType: body.vehicleType ? (body.vehicleType as VehicleType) : null,
    weightTons,
    pickupAt,
    etaAt,
    targetPriceVnd,
    abnormalNote: body.abnormalNote ? String(body.abnormalNote) : null,
    note: body.note ? String(body.note) : null,
    originLat,
    originLng,
    destLat,
    destLng,
    items: items.map((it) => ({
      lengthCm: Number(it.lengthCm),
      widthCm: Number(it.widthCm),
      heightCm: Number(it.heightCm),
      quantity: Number(it.quantity) || 1,
    })),
    cargoVolumeM3: (() => {
      const computed = volumeFromItems(items);
      if (computed > 0) return computed;
      const manual = Number(body.cargoVolumeM3);
      return Number.isFinite(manual) && manual > 0 ? manual : 0;
    })(),
  };
}

function shipmentData(parsed: ReturnType<typeof parseOrderBody>, extra: Record<string, unknown>) {
  const cargoName = parsed.items.map((i) => `${i.lengthCm}x${i.widthCm}x${i.heightCm}cm x${i.quantity}`).join("; ");
  return {
    pickupAddress: [parsed.originProvince, parsed.originCity, parsed.originAddress].filter(Boolean).join(" ") || "-",
    pickupContact: parsed.originContact,
    pickupPhone: parsed.originPhone,
    pickupNote: parsed.note,
    pickupAt: parsed.pickupAt,
    deliveryAddress: [parsed.destProvince, parsed.destCity, parsed.destAddress].filter(Boolean).join(" ") || "-",
    deliveryContact: parsed.destContact,
    deliveryPhone: parsed.destPhone,
    cargoName: cargoName || "货物",
    cargoWeightKg: parsed.weightTons * 1000,
    cargoVolumeM3: parsed.cargoVolumeM3,
    vehicleType: parsed.vehicleType,
    originProvince: parsed.originProvince,
    originCity: parsed.originCity,
    originAddress: parsed.originAddress,
    destProvince: parsed.destProvince,
    destCity: parsed.destCity,
    destAddress: parsed.destAddress,
    originLat: parsed.originLat,
    originLng: parsed.originLng,
    destLat: parsed.destLat,
    destLng: parsed.destLng,
    cargoType: parsed.cargoType,
    packaging: parsed.packaging,
    weightTons: parsed.weightTons,
      etaAt: parsed.etaAt ?? parsed.pickupAt,
    targetPriceVnd: parsed.targetPriceVnd,
    customerBidVnd: parsed.targetPriceVnd,
    abnormalNote: parsed.abnormalNote,
    ...extra,
  };
}

export async function createPublishedOrder(customerId: string, body: Record<string, unknown>, actorId: string, note: string) {
  const cfg = await getConfig();
  const parsed = parseOrderBody(body);
  const now = new Date();
  const deadlines = buildDeadlines(now, parsed.pickupAt, cfg);
  const path = parsed.targetPriceVnd ? MatchPath.A : MatchPath.B;
  const order = await prisma.order.create({
    data: {
      ...(shipmentData(parsed, {
        orderNo: genOrderNo(),
        customerId,
        status: OrderStatus.OPEN,
        matchPath: path,
        commissionBps: cfg.commissionBps,
        waitDeadline: deadlines.waitDeadline,
        bidDeadline: deadlines.bidDeadline,
        publishRound: 1,
        extendCount: 0,
      }) as Prisma.OrderCreateInput),
      cargoItems: { create: parsed.items },
      statusLogs: {
        create: { toStatus: OrderStatus.OPEN, note, operatorId: actorId },
      },
    },
  });
  await logOp(actorId, "ORDER_CREATE", "order", order.id, note);
  void locateAndSuggestOrder(order.id).catch((error) => console.error("suggest-order", error));
  return order;
}

async function republish(orderId: string, actorId: string | null, note: string, rejectReason?: string | null) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  const cfg = await getConfig();
  const now = new Date();
  const deadlines = buildDeadlines(now, order.pickupAt, cfg);
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.OPEN,
      publishRound: order.publishRound + 1,
      acceptedByUserId: null,
      assignedToUserId: null,
      dealPriceVnd: null,
      platformFeeVnd: null,
      driverIncomeVnd: null,
      confirmDeadline: null,
      auditDeadline: null,
      waitDeadline: deadlines.waitDeadline,
      bidDeadline: deadlines.bidDeadline,
      extendCount: 0,
      rejectReason: rejectReason === undefined ? order.rejectReason : rejectReason,
      statusLogs: {
        create: {
          fromStatus: order.status,
          toStatus: OrderStatus.OPEN,
          note,
          operatorId: actorId,
        },
      },
    },
  });
  await logOp(actorId, "ORDER_REPUBLISH", "order", orderId, note);
  void locateAndSuggestOrder(orderId).catch((error) => console.error("suggest-order", error));
  return updated;
}

function lowestBid<T extends { priceVnd: bigint; createdAt: Date }>(bids: T[]) {
  return [...bids].sort((a, b) => (a.priceVnd < b.priceVnd ? -1 : a.priceVnd > b.priceVnd ? 1 : a.createdAt.getTime() - b.createdAt.getTime()))[0];
}

function settled(price: bigint, bps: number) {
  return {
    status: OrderStatus.PENDING_EXECUTION,
    trackShareOn: true,
    auditDeadline: null as Date | null,
    rejectReason: null as string | null,
    ...moneyFields(price, bps),
  };
}

let sweepTask: Promise<void> | null = null;
let sweepAt = 0;

export function sweepDeadlines(force = false) {
  const nowMs = Date.now();
  if (sweepTask) return sweepTask;
  if (!force && nowMs - sweepAt < 20000) return Promise.resolve();
  sweepAt = nowMs;
  sweepTask = runSweep().finally(() => {
    sweepTask = null;
  });
  return sweepTask;
}

async function runSweep() {
  const cfg = await getConfig();
  const now = new Date();
  const open = await prisma.order.findMany({
    where: {
      status: OrderStatus.OPEN,
      matchPath: { in: [MatchPath.A, MatchPath.B] },
      OR: [
        { waitDeadline: { lte: now } },
        { bidDeadline: { lte: now } },
        ...(cfg.confirmTimerStart === "AFTER_FIRST_BID" ? [{ carrierBids: { some: {} } }] : []),
      ],
    },
    include: { carrierBids: true },
  });
  for (const order of open) {
    const waitHit = !!(order.waitDeadline && order.waitDeadline <= now);
    const bidHit = !!(order.bidDeadline && order.bidDeadline <= now);
    const waitFirst = !!(order.waitDeadline && order.bidDeadline && order.waitDeadline <= order.bidDeadline);
    const first = [...order.carrierBids].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (order.matchPath === MatchPath.A) {
      if (waitHit || bidHit) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED, statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.FAILED, note: "无人接单流标" } } },
        });
      }
      continue;
    }
    if (waitHit && (waitFirst || !bidHit)) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED, statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.FAILED, note: "等待匹配超时流标" } } },
      });
      continue;
    }
    const confirmStart = cfg.confirmTimerStart === "AFTER_FIRST_BID" ? first?.createdAt : bidHit ? order.bidDeadline : null;
    if (confirmStart && confirmStart <= now) {
      if (!first) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED, statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.FAILED, note: "无报价流标" } } },
        });
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PENDING_CONFIRM,
            confirmDeadline: addMinutes(confirmStart, cfg.confirmMinutes),
          },
        });
      }
    }
  }

  const confirming = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING_CONFIRM, confirmDeadline: { lte: now } },
    include: { carrierBids: true },
  });
  for (const order of confirming) {
    const roundBids = order.carrierBids.filter((b) => b.publishRound === order.publishRound);
    const best = lowestBid(roundBids);
    if (!best) {
      await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
      continue;
    }
    const bps = order.commissionBps || cfg.commissionBps;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        ...settled(best.priceVnd, bps),
        acceptedByUserId: best.bidderUserId,
        statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "客户确认超时，按最低价成交" } },
      },
    });
  }

  const waitingReview = await prisma.order.findMany({
    where: { status: { in: [OrderStatus.LOCKED, OrderStatus.PENDING_AUDIT] } },
    select: { id: true, status: true },
  });
  for (const order of waitingReview) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PENDING_EXECUTION,
        trackShareOn: true,
        auditDeadline: null,
        rejectReason: null,
        statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "平台不审核匹配，直接进入待执行" } },
      },
    });
  }

  await prisma.capacityNegotiation.updateMany({
    where: { status: NegotiationStatus.PENDING, respondDeadline: { lte: now } },
    data: { status: NegotiationStatus.EXPIRED },
  });

  const expiredSuggestions = await prisma.matchSuggestion.findMany({
    where: {
      status: { in: ["PENDING", "CUSTOMER_OK", "DRIVER_OK"] },
      deadline: { lte: now },
    },
    take: 100,
  });
  for (const row of expiredSuggestions) {
    await prisma.matchSuggestion.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
    const [order, cap] = await Promise.all([
      prisma.order.findUnique({ where: { id: row.orderId }, select: { customerId: true, orderNo: true } }),
      prisma.capacity.findUnique({ where: { id: row.capacityId }, select: { publisherUserId: true } }),
    ]);
    if (order && cap) {
      await notify(order.customerId, "撮合建议已过期", `订单 ${order.orderNo} 的顺路匹配已超过有效期`);
      await notify(cap.publisherUserId, "撮合建议已过期", `订单 ${order.orderNo} 的顺路匹配已超过有效期`);
    }
  }

  const halfOk = await prisma.matchSuggestion.findMany({
    where: {
      status: { in: ["CUSTOMER_OK", "DRIVER_OK"] },
      deadline: { gt: now },
    },
    take: 50,
  });
  for (const row of halfOk) {
    if (!row.deadline) continue;
    const remain = row.deadline.getTime() - now.getTime();
    if (remain > 10 * 60 * 1000) continue;
    const [order, cap] = await Promise.all([
      prisma.order.findUnique({ where: { id: row.orderId }, select: { customerId: true, orderNo: true } }),
      prisma.capacity.findUnique({ where: { id: row.capacityId }, select: { publisherUserId: true } }),
    ]);
    if (!order || !cap) continue;
    const target = row.status === "CUSTOMER_OK" ? cap.publisherUserId : order.customerId;
    await notify(target, "请尽快确认撮合", `订单 ${order.orderNo} 对方已确认，有效期即将结束`);
  }
}

export async function acceptPathA(orderId: string, userId: string) {
  await sweepDeadlines();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CARRIER_MAIN") throw new Error("仅公司主账号或个人司机可接单");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== OrderStatus.OPEN || order.matchPath !== MatchPath.A) throw new Error("当前订单不可接单");
  if (!order.targetPriceVnd) throw new Error("订单缺少目标价");
  const cfg = await getConfig();
  const bps = order.commissionBps || cfg.commissionBps;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...settled(order.targetPriceVnd, bps),
      acceptedByUserId: userId,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "司机接单，直接进入待执行", operatorId: userId } },
    },
  });
  await logOp(userId, "ORDER_ACCEPT", "order", orderId);
  return updated;
}

export async function placeBid(orderId: string, userId: string, priceVnd: bigint) {
  await sweepDeadlines();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.role !== "CARRIER_MAIN" && user.role !== "CARRIER_SUB")) throw new Error("无权报价");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== OrderStatus.OPEN || order.matchPath !== MatchPath.B) throw new Error("当前订单不可报价");
  const bid = await prisma.carrierBid.upsert({
    where: { orderId_publishRound_bidderUserId: { orderId, publishRound: order.publishRound, bidderUserId: userId } },
    create: { orderId, publishRound: order.publishRound, bidderUserId: userId, priceVnd },
    update: { priceVnd },
  });
  await logOp(userId, "ORDER_BID", "order", orderId, priceVnd.toString());
  return bid;
}

export async function confirmBid(orderId: string, customerId: string, bidId: string) {
  await sweepDeadlines();
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
  if (!order || order.status !== OrderStatus.PENDING_CONFIRM) throw new Error("当前不在确认窗口");
  const bid = await prisma.carrierBid.findFirst({ where: { id: bidId, orderId, publishRound: order.publishRound } });
  if (!bid) throw new Error("报价不存在");
  const cfg = await getConfig();
  const bps = order.commissionBps || cfg.commissionBps;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...settled(bid.priceVnd, bps),
      acceptedByUserId: bid.bidderUserId,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "客户确认报价，直接进入待执行", operatorId: customerId } },
    },
  });
  await logOp(customerId, "ORDER_CONFIRM", "order", orderId);
  return updated;
}

export async function rejectAllBids(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId, status: OrderStatus.PENDING_CONFIRM } });
  if (!order) throw new Error("当前不可拒绝");
  return republish(orderId, customerId, "客户拒绝全部报价，自动重新发布", null);
}

export async function auditOrder(orderId: string, adminId: string, pass: boolean, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (order.status !== OrderStatus.LOCKED && order.status !== OrderStatus.PENDING_AUDIT)) {
    throw new Error("当前订单不在待审核");
  }
  if (!pass) {
    const why = (reason || "").trim();
    if (!why) throw new Error("拒绝必须填写理由");
    const updated = await republish(orderId, adminId, `平台审核拒绝：${why}`, why);
    if (order.customerId) await notify(order.customerId, "订单审核未通过", why);
    return updated;
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PENDING_EXECUTION,
      trackShareOn: true,
      rejectReason: null,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "平台审核通过", operatorId: adminId } },
    },
  });
  await logOp(adminId, "ORDER_AUDIT_PASS", "order", orderId);
  return updated;
}

export async function assignSub(orderId: string, mainUserId: string, subUserId: string) {
  const main = await prisma.user.findUnique({ where: { id: mainUserId } });
  const sub = await prisma.user.findUnique({ where: { id: subUserId } });
  if (!main || main.role !== "CARRIER_MAIN") throw new Error("仅主账号可分配");
  if (!sub || sub.parentUserId !== mainUserId) throw new Error("只能分配给本公司司机");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.acceptedByUserId !== mainUserId) throw new Error("只能分配自己接下的订单");
  if (order.status !== OrderStatus.PENDING_EXECUTION && order.status !== OrderStatus.IN_TRANSIT) {
    throw new Error("当前状态不可分配");
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      assignedToUserId: subUserId,
      statusLogs: { create: { fromStatus: order.status, toStatus: order.status, note: "分配给司机子账号", operatorId: mainUserId } },
    },
  });
  await notify(subUserId, "新任务", `订单 ${order.orderNo} 已分配给你，状态为待执行`);
  await logOp(mainUserId, "ORDER_ASSIGN", "order", orderId, subUserId);
  return updated;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING_EXECUTION: OrderStatus.IN_TRANSIT,
  IN_TRANSIT: OrderStatus.DELIVERED,
};

export async function advanceOrder(orderId: string, userId: string, asAdmin = false) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  const next = NEXT_STATUS[order.status];
  if (!next) throw new Error("当前状态不可推进");
  if (!asAdmin && order.acceptedByUserId !== userId && order.assignedToUserId !== userId) {
    throw new Error("无权推进该订单");
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: next,
      trackShareOn: shareOnForStatus(next),
      statusLogs: { create: { fromStatus: order.status, toStatus: next, note: "履约状态推进", operatorId: userId } },
    },
  });
  await logOp(userId, "ORDER_ADVANCE", "order", orderId, next);
  return updated;
}

export async function setDriverStage(orderId: string, userId: string, stageKey: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (order.acceptedByUserId !== userId && order.assignedToUserId !== userId) throw new Error("无权更新该订单");
  const allowed: OrderStatus[] = [OrderStatus.PENDING_EXECUTION, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.MATCHED];
  if (!allowed.includes(order.status)) throw new Error("当前状态不能更新运输节点");
  const issue = stageKey === DRIVER_ISSUE.key;
  const spec = DRIVER_STAGES.find((stage) => stage.key === stageKey);
  if (!issue && !spec) throw new Error("未知节点");
  if (order.status === OrderStatus.DELIVERED && stageKey !== "delivered" && !issue) {
    throw new Error("已送达后不能改回前面的节点");
  }
  const next = (issue ? order.status : spec!.status) as OrderStatus;
  const label = issue ? DRIVER_ISSUE.label : spec!.label;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      driverStage: stageKey,
      status: next,
      trackShareOn: shareOnForStatus(next),
      statusLogs: { create: { fromStatus: order.status, toStatus: next, note: `司机更新节点：${label}`, operatorId: userId } },
    },
  });
  await logOp(userId, "ORDER_STAGE", "order", orderId, stageKey);
  return updated;
}

export async function customerComplete(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId, status: OrderStatus.DELIVERED } });
  if (!order) throw new Error("仅已送达订单可确认完成");
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      trackShareOn: false,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.COMPLETED, note: "客户确认完成", operatorId: customerId } },
    },
  });
}

export async function extendOrder(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId, status: OrderStatus.OPEN } });
  if (!order) throw new Error("仅匹配中的订单可延长");
  const cfg = await getConfig();
  if (order.extendCount >= cfg.maxExtends) throw new Error("已达到延长次数上限");
  const waitDeadline = order.waitDeadline ? addHours(order.waitDeadline, cfg.extendHours) : addHours(new Date(), cfg.extendHours);
  const bidDeadline = order.bidDeadline ? addHours(order.bidDeadline, cfg.extendHours) : null;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      extendCount: order.extendCount + 1,
      waitDeadline,
      bidDeadline,
      statusLogs: { create: { fromStatus: order.status, toStatus: order.status, note: "客户延长有效期", operatorId: customerId } },
    },
  });
  await logOp(customerId, "ORDER_EXTEND", "order", orderId);
  return updated;
}

export async function cancelOrder(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
  if (!order) throw new Error("订单不存在");
  const ok: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.PENDING_CONFIRM, OrderStatus.FAILED, OrderStatus.REJECTED, OrderStatus.PENDING_REVIEW];
  if (!ok.includes(order.status)) throw new Error("当前状态不可取消");
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      trackShareOn: false,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.CANCELLED, note: "客户取消", operatorId: customerId } },
    },
  });
}

export async function customerRevise(orderId: string, customerId: string, body: Record<string, unknown>) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
  if (!order) throw new Error("订单不存在");
  if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.FAILED && order.status !== OrderStatus.REJECTED && order.status !== OrderStatus.PENDING_REVIEW) {
    throw new Error("当前状态不可修改");
  }
  const cfg = await getConfig();
  const parsed = parseOrderBody(body);
  const now = new Date();
  const deadlines = buildDeadlines(now, parsed.pickupAt, cfg);
  const path = parsed.targetPriceVnd ? MatchPath.A : MatchPath.B;
  await prisma.orderCargoItem.deleteMany({ where: { orderId } });
  const data = shipmentData(parsed, {
    status: OrderStatus.OPEN,
    matchPath: path,
    waitDeadline: deadlines.waitDeadline,
    bidDeadline: deadlines.bidDeadline,
    publishRound: order.publishRound + (order.status === OrderStatus.FAILED ? 1 : 0),
    extendCount: 0,
    confirmDeadline: null,
    auditDeadline: null,
    acceptedByUserId: null,
    dealPriceVnd: null,
    platformFeeVnd: null,
    driverIncomeVnd: null,
    rejectReason: null,
  });
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...data,
      cargoItems: { create: parsed.items },
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.OPEN, note: "客户修改后重新发布", operatorId: customerId } },
    },
  });
  void locateAndSuggestOrder(updated.id).catch((error) => console.error("suggest-order", error));
  return updated;
}

function capacityFields(body: Record<string, unknown>) {
  const locationPlace = placeById(body.locationPlaceId);
  const destPlace = placeById(body.destPlaceId);
  const locationExtra = String(body.locationAddress || body.location || "").trim();
  const location = locationPlace
    ? locationExtra.includes(locationPlace.name)
      ? locationExtra
      : [locationPlace.name, locationExtra].filter(Boolean).join(" ")
    : [body.locationProvince, body.locationWard, locationExtra]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
  const destExtra = String(body.destAddress || body.destPreference || "").trim();
  const destPreference = destPlace
    ? destExtra.includes(destPlace.name)
      ? destExtra
      : [destPlace.name, destExtra].filter(Boolean).join(" ")
    : [body.destProvince, body.destWard, destExtra]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
  if (!location) throw new Error("请填写当前空车位置，或选择堆场/码头");
  const availableFrom = new Date(String(body.availableFrom || ""));
  const availableTo = new Date(String(body.availableTo || ""));
  if (Number.isNaN(availableFrom.getTime()) || Number.isNaN(availableTo.getTime())) throw new Error("请填写可接货时间");
  return {
    location,
    locationLat: locationPlace?.lat ?? null,
    locationLng: locationPlace?.lng ?? null,
    destLat: destPlace?.lat ?? null,
    destLng: destPlace?.lng ?? null,
    availableFrom,
    availableTo,
    destPreference: destPreference || null,
    vehicleType: body.vehicleType as VehicleType,
    loadTons: Number(body.loadTons),
    cargoTypes: String(body.cargoTypes || "GENERAL"),
    airportOk: Boolean(body.airportOk),
    portOk: Boolean(body.portOk),
    expectedPriceVnd: toBigIntMoney(body.expectedPriceVnd as number),
    note: body.note ? String(body.note) : null,
  };
}

export async function createCapacity(publisherUserId: string, body: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: publisherUserId } });
  if (!user || (user.role !== "CARRIER_MAIN" && user.role !== "CARRIER_SUB")) throw new Error("无权发布运力");
  const row = await prisma.capacity.create({ data: { publisherUserId, ...capacityFields(body) } });
  await logOp(publisherUserId, "CAPACITY_CREATE", "capacity", row.id);
  void locateAndSuggestCapacity(row.id).catch((error) => console.error("suggest-capacity", error));
  return row;
}

export async function updateCapacity(capacityId: string, publisherUserId: string, body: Record<string, unknown>) {
  const current = await prisma.capacity.findUnique({ where: { id: capacityId } });
  if (!current || current.publisherUserId !== publisherUserId) throw new Error("运力不存在");
  if (current.status !== "OPEN") throw new Error("只有未匹配的运力可以编辑");
  const next = await prisma.capacity.update({ where: { id: capacityId }, data: capacityFields(body) });
  await logOp(publisherUserId, "CAPACITY_UPDATE", "capacity", capacityId);
  void locateAndSuggestCapacity(capacityId).catch((error) => console.error("suggest-capacity", error));
  return next;
}

export async function closeCapacity(capacityId: string, publisherUserId: string) {
  const current = await prisma.capacity.findUnique({ where: { id: capacityId } });
  if (!current || current.publisherUserId !== publisherUserId) throw new Error("运力不存在");
  if (current.status === "MATCHED") throw new Error("这条运力已经匹配成订单，请到订单里取消");
  if (current.status === "CLOSED") return current;
  const next = await prisma.capacity.update({ where: { id: capacityId }, data: { status: "CLOSED" } });
  await logOp(publisherUserId, "CAPACITY_CLOSE", "capacity", capacityId);
  return next;
}

async function negotiationShipment(body: Record<string, unknown>, capacityId: string, customerId: string, price: bigint, deadline: Date | null) {
  const parsed = parseOrderBody(body);
  return prisma.capacityNegotiation.create({
    data: {
      capacityId,
      customerId,
      priceVnd: price,
      status: deadline ? NegotiationStatus.PENDING : NegotiationStatus.ACCEPTED,
      originProvince: parsed.originProvince,
      originCity: parsed.originCity,
      originAddress: parsed.originAddress,
      originContact: parsed.originContact,
      originPhone: parsed.originPhone,
      destProvince: parsed.destProvince,
      destCity: parsed.destCity,
      destAddress: parsed.destAddress,
      destContact: parsed.destContact,
      destPhone: parsed.destPhone,
      cargoType: parsed.cargoType,
      packaging: parsed.packaging,
      weightTons: parsed.weightTons,
      pickupAt: parsed.pickupAt,
      etaAt: parsed.etaAt ?? parsed.pickupAt,
      note: parsed.note,
      respondDeadline: deadline,
    },
  });
}

async function orderFromNegotiation(negId: string, actorId: string) {
  const neg = await prisma.capacityNegotiation.findUnique({ where: { id: negId }, include: { capacity: true } });
  if (!neg) throw new Error("协商不存在");
  const cfg = await getConfig();
  const publisher = await prisma.user.findUnique({ where: { id: neg.capacity.publisherUserId } });
  const acceptedBy = publisher?.role === "CARRIER_SUB" ? publisher.parentUserId || publisher.id : neg.capacity.publisherUserId;
  const bps = cfg.commissionBps;
  const cargoName = `${neg.cargoType}/${neg.packaging}/${neg.weightTons}吨`;
  const order = await prisma.order.create({
    data: {
      orderNo: genOrderNo(),
      customerId: neg.customerId,
      ...settled(neg.priceVnd, bps),
      matchPath: MatchPath.C,
      originLat: placeFromText([neg.originAddress, neg.originCity, neg.originProvince].join(" "))?.lat ?? null,
      originLng: placeFromText([neg.originAddress, neg.originCity, neg.originProvince].join(" "))?.lng ?? null,
      destLat: placeFromText([neg.destAddress, neg.destCity, neg.destProvince].join(" "))?.lat ?? null,
      destLng: placeFromText([neg.destAddress, neg.destCity, neg.destProvince].join(" "))?.lng ?? null,
      pickupAddress: [neg.originProvince, neg.originCity, neg.originAddress].filter(Boolean).join(" "),
      pickupContact: neg.originContact,
      pickupPhone: neg.originPhone,
      pickupAt: neg.pickupAt,
      deliveryAddress: [neg.destProvince, neg.destCity, neg.destAddress].filter(Boolean).join(" "),
      deliveryContact: neg.destContact,
      deliveryPhone: neg.destPhone,
      cargoName,
      cargoWeightKg: neg.weightTons * 1000,
      cargoVolumeM3: 0,
      vehicleType: neg.capacity.vehicleType,
      cargoType: neg.cargoType,
      packaging: neg.packaging,
      originProvince: neg.originProvince,
      originCity: neg.originCity,
      originAddress: neg.originAddress,
      destProvince: neg.destProvince,
      destCity: neg.destCity,
      destAddress: neg.destAddress,
      weightTons: neg.weightTons,
      etaAt: neg.etaAt,
      targetPriceVnd: neg.priceVnd,
      customerBidVnd: neg.priceVnd,
      commissionBps: bps,
      acceptedByUserId: acceptedBy,
      assignedToUserId: publisher?.role === "CARRIER_SUB" ? publisher.id : null,
      capacityId: neg.capacityId,
      statusLogs: { create: { toStatus: OrderStatus.PENDING_EXECUTION, note: "运力匹配成功，直接进入待执行", operatorId: actorId } },
    },
  });
  await prisma.capacityNegotiation.update({ where: { id: negId }, data: { status: NegotiationStatus.ACCEPTED, orderId: order.id } });
  await prisma.capacity.update({ where: { id: neg.capacityId }, data: { status: "MATCHED" } });
  if (publisher?.role === "CARRIER_SUB" && publisher.parentUserId) {
    await notify(publisher.parentUserId, "运力协商已接受", `司机已接受协商，订单 ${order.orderNo} 已进入待执行`);
  }
  await logOp(actorId, "CAPACITY_MATCH", "order", order.id);
  return order;
}

export async function matchCapacity(capacityId: string, customerId: string, body: Record<string, unknown>) {
  const cap = await prisma.capacity.findUnique({ where: { id: capacityId } });
  const block = capacityMatchBlock(cap?.status);
  if (block || !cap) throw new Error(block || "找不到这条运力");
  const acceptExpected = Boolean(body.acceptExpected);
  const cfg = await getConfig();
  if (acceptExpected) {
    const neg = await negotiationShipment(body, capacityId, customerId, cap.expectedPriceVnd, null);
    return orderFromNegotiation(neg.id, customerId);
  }
  const price = toBigIntMoney(body.priceVnd as number);
  const neg = await negotiationShipment(body, capacityId, customerId, price, addMinutes(new Date(), cfg.negotiateMinutes));
  await notify(cap.publisherUserId, "新的运力协商", `客户提出价格 ${price.toString()} VND`);
  await logOp(customerId, "CAPACITY_NEGOTIATE", "capacity", capacityId);
  return neg;
}

export async function respondNegotiation(negId: string, userId: string, accept: boolean) {
  const neg = await prisma.capacityNegotiation.findUnique({ where: { id: negId }, include: { capacity: true } });
  if (!neg || neg.status !== NegotiationStatus.PENDING) throw new Error("协商已结束");
  if (neg.capacity.publisherUserId !== userId) throw new Error("无权处理该协商");
  if (!accept) {
    const updated = await prisma.capacityNegotiation.update({ where: { id: negId }, data: { status: NegotiationStatus.REJECTED } });
    await notify(neg.customerId, "司机未接受协商价", "你可以再次发起协商");
    await logOp(userId, "CAPACITY_REJECT", "capacity", neg.capacityId);
    return updated;
  }
  return orderFromNegotiation(negId, userId);
}

function point(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function persistSuggestions(
  order: {
    id: string;
    customerId: string;
    orderNo: string;
    originLat: number | null;
    originLng: number | null;
    destLat: number | null;
    destLng: number | null;
    pickupAt?: Date | null;
    vehicleType?: string | null;
    weightTons?: number | null;
    cargoType?: string | null;
  },
  capacities: Array<{
    id: string;
    publisherUserId: string;
    locationLat: number | null;
    locationLng: number | null;
    destLat: number | null;
    destLng: number | null;
    destPreference: string | null;
    availableFrom?: Date | null;
    availableTo?: Date | null;
    vehicleType?: string | null;
    loadTons?: number | null;
    cargoTypes?: string | null;
    airportOk?: boolean;
    portOk?: boolean;
  }>
) {
  const cfg = await getConfig();
  const deadline = addMinutes(new Date(), cfg.negotiateMinutes);
  for (const cap of capacities) {
    const scored = scoreRouteFit({
      orderOrigin: point(order.originLat, order.originLng),
      orderDest: point(order.destLat, order.destLng),
      pickupAt: order.pickupAt,
      vehicleType: order.vehicleType,
      weightTons: order.weightTons,
      cargoType: order.cargoType,
      capLocation: point(cap.locationLat, cap.locationLng),
      capDest: point(cap.destLat, cap.destLng),
      availableFrom: cap.availableFrom,
      availableTo: cap.availableTo,
      capVehicleType: cap.vehicleType,
      loadTons: cap.loadTons,
      cargoTypes: cap.cargoTypes,
      airportOk: cap.airportOk,
      portOk: cap.portOk,
    });
    if (!scored || scored.score < SUGGEST_MIN_SCORE) continue;
    const existing = await prisma.matchSuggestion.findUnique({
      where: { orderId_capacityId: { orderId: order.id, capacityId: cap.id } },
    });
    if (existing) {
      if (existing.status === "PENDING" || existing.status === "EXPIRED") {
        await prisma.matchSuggestion.update({
          where: { id: existing.id },
          data: {
            distanceKm: scored.distanceKm,
            basis: scored.basis,
            score: scored.score,
            reason: scored.reason,
            status: "PENDING",
            deadline,
          },
        });
      }
      continue;
    }
    await prisma.matchSuggestion.create({
      data: {
        orderId: order.id,
        capacityId: cap.id,
        distanceKm: scored.distanceKm,
        basis: scored.basis,
        score: scored.score,
        reason: scored.reason,
        status: "PENDING",
        deadline,
      },
    });
    await notify(order.customerId, "发现顺路运力", `订单 ${order.orderNo}：${scored.reason}。请在 ${cfg.negotiateMinutes} 分钟内确认。`);
    await notify(cap.publisherUserId, "发现顺路货源", `客户订单 ${order.orderNo}：${scored.reason}。请在 ${cfg.negotiateMinutes} 分钟内确认。`);
  }
}

export async function locateAndSuggestOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.BIDDING)) return;
  const origin =
    order.originLat != null && order.originLng != null
      ? { lat: order.originLat, lng: order.originLng }
      : await geocode([order.originAddress, order.originCity, order.originProvince].filter(Boolean).join(", "));
  const dest =
    order.destLat != null && order.destLng != null
      ? { lat: order.destLat, lng: order.destLng }
      : await geocode([order.destAddress, order.destCity, order.destProvince].filter(Boolean).join(", "));
  let routeDistanceKm = order.routeDistanceKm;
  let routeDurationMin = order.routeDurationMin;
  let routeSource = order.routeSource;
  if (origin && dest) {
    const route = await routeEstimate(origin, dest);
    routeDistanceKm = route.distanceKm;
    routeDurationMin = route.durationMin;
    routeSource = route.source;
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      originLat: origin?.lat ?? order.originLat,
      originLng: origin?.lng ?? order.originLng,
      destLat: dest?.lat ?? order.destLat,
      destLng: dest?.lng ?? order.destLng,
      routeDistanceKm,
      routeDurationMin,
      routeSource,
    },
  });
  const caps = await prisma.capacity.findMany({ where: { status: "OPEN" } });
  await persistSuggestions(updated, caps);
}

export async function locateAndSuggestCapacity(capacityId: string) {
  const cap = await prisma.capacity.findUnique({ where: { id: capacityId } });
  if (!cap || cap.status !== "OPEN") return;
  const location =
    cap.locationLat != null && cap.locationLng != null ? { lat: cap.locationLat, lng: cap.locationLng } : await geocode(cap.location);
  const dest =
    cap.destLat != null && cap.destLng != null
      ? { lat: cap.destLat, lng: cap.destLng }
      : cap.destPreference
        ? await geocode(cap.destPreference)
        : null;
  const updated = await prisma.capacity.update({
    where: { id: capacityId },
    data: {
      locationLat: location?.lat ?? cap.locationLat,
      locationLng: location?.lng ?? cap.locationLng,
      destLat: dest?.lat ?? cap.destLat,
      destLng: dest?.lng ?? cap.destLng,
    },
  });
  const orders = await prisma.order.findMany({ where: { status: { in: [OrderStatus.OPEN, OrderStatus.BIDDING] } } });
  for (const order of orders) await persistSuggestions(order, [updated]);
}

export async function listSuggestions(userId: string) {
  const [orders, caps] = await Promise.all([
    prisma.order.findMany({ where: { customerId: userId }, select: { id: true } }),
    prisma.capacity.findMany({ where: { publisherUserId: userId }, select: { id: true } }),
  ]);
  const orderIds = orders.map((row) => row.id);
  const capIds = caps.map((row) => row.id);
  if (!orderIds.length && !capIds.length) return [];
  const rows = await prisma.matchSuggestion.findMany({
    where: {
      status: { in: ["PENDING", "CUSTOMER_OK", "DRIVER_OK"] },
      OR: [...(orderIds.length ? [{ orderId: { in: orderIds } }] : []), ...(capIds.length ? [{ capacityId: { in: capIds } }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (!rows.length) return [];
  const orderRows = await prisma.order.findMany({
    where: { id: { in: rows.map((row) => row.orderId) } },
    select: {
      id: true,
      orderNo: true,
      customerId: true,
      pickupAddress: true,
      deliveryAddress: true,
      originAddress: true,
      destAddress: true,
    },
  });
  const capRows = await prisma.capacity.findMany({
    where: { id: { in: rows.map((row) => row.capacityId) } },
    select: { id: true, publisherUserId: true, location: true, destPreference: true, expectedPriceVnd: true },
  });
  const orderMap = new Map(orderRows.map((row) => [row.id, row]));
  const capMap = new Map(capRows.map((row) => [row.id, row]));
  return rows.flatMap((row) => {
    const order = orderMap.get(row.orderId);
    const cap = capMap.get(row.capacityId);
    if (!order || !cap) return [];
    const mine = order.customerId === userId ? "customer" : "driver";
    return [
      {
        id: row.id,
        status: row.status,
        distanceKm: row.distanceKm,
        basis: row.basis,
        score: row.score,
        reason: row.reason,
        deadline: row.deadline,
        orderNo: order.orderNo,
        pickup: order.originAddress || order.pickupAddress,
        delivery: order.destAddress || order.deliveryAddress,
        location: cap.location,
        destPreference: cap.destPreference,
        expectedPriceVnd: cap.expectedPriceVnd.toString(),
        mine,
        waiting: (mine === "customer" && row.status === "CUSTOMER_OK") || (mine === "driver" && row.status === "DRIVER_OK"),
      },
    ];
  });
}

export async function respondSuggestion(id: string, userId: string, accept: boolean) {
  const row = await prisma.matchSuggestion.findUnique({ where: { id } });
  if (!row || row.status === "MATCHED" || row.status === "REJECTED" || row.status === "EXPIRED") throw new Error("撮合建议已处理或已过期");
  if (row.deadline && row.deadline.getTime() < Date.now()) {
    await prisma.matchSuggestion.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new Error("撮合建议已过期");
  }
  const [order, cap] = await Promise.all([
    prisma.order.findUnique({ where: { id: row.orderId } }),
    prisma.capacity.findUnique({ where: { id: row.capacityId } }),
  ]);
  if (!order || !cap) throw new Error("订单或运力不存在");
  const isCustomer = order.customerId === userId;
  const isDriver = cap.publisherUserId === userId;
  if (!isCustomer && !isDriver) throw new Error("无权处理该撮合");
  if (!accept) {
    await prisma.matchSuggestion.update({ where: { id }, data: { status: "REJECTED" } });
    await notify(isCustomer ? cap.publisherUserId : order.customerId, "对方未确认撮合", `订单 ${order.orderNo} 的附近匹配未达成`);
    return { status: "REJECTED" };
  }
  const next = isCustomer ? (row.status === "DRIVER_OK" ? "MATCHED" : "CUSTOMER_OK") : row.status === "CUSTOMER_OK" ? "MATCHED" : "DRIVER_OK";
  if ((isCustomer && row.status === "CUSTOMER_OK") || (isDriver && row.status === "DRIVER_OK")) return { status: row.status };
  if (next !== "MATCHED") {
    await prisma.matchSuggestion.update({ where: { id }, data: { status: next } });
    await notify(
      isCustomer ? cap.publisherUserId : order.customerId,
      "对方已确认顺路撮合",
      `订单 ${order.orderNo}：${row.reason || `装货距离约 ${row.distanceKm} 公里`}。请尽快确认。`
    );
    return { status: next };
  }
  const unavailable = capacityMatchBlock(cap.status);
  if (unavailable) throw new Error(unavailable);
  const openish: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.BIDDING];
  if (!openish.includes(order.status)) throw new Error("订单已不在撮合中");
  const price = order.targetPriceVnd && order.targetPriceVnd > 0n ? order.targetPriceVnd : cap.expectedPriceVnd;
  const cfg = await getConfig();
  const bps = order.commissionBps ?? cfg.commissionBps;
  const publisher = await prisma.user.findUnique({ where: { id: cap.publisherUserId } });
  const acceptedBy = publisher?.role === "CARRIER_SUB" ? publisher.parentUserId || publisher.id : cap.publisherUserId;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      ...settled(price, bps),
      matchPath: MatchPath.C,
      vehicleType: order.vehicleType || cap.vehicleType,
      acceptedByUserId: acceptedBy,
      assignedToUserId: publisher?.role === "CARRIER_SUB" ? publisher.id : null,
      capacityId: cap.id,
      targetPriceVnd: order.targetPriceVnd || price,
      customerBidVnd: order.customerBidVnd || price,
      commissionBps: bps,
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "双方确认附近撮合，直接进入待执行", operatorId: userId } },
    },
  });
  await prisma.capacity.update({ where: { id: cap.id }, data: { status: "MATCHED" } });
  await prisma.matchSuggestion.update({ where: { id }, data: { status: "MATCHED" } });
  await prisma.matchSuggestion.updateMany({
    where: {
      id: { not: id },
      status: { in: ["PENDING", "CUSTOMER_OK", "DRIVER_OK"] },
      OR: [{ orderId: order.id }, { capacityId: cap.id }],
    },
    data: { status: "REJECTED" },
  });
  await notify(order.customerId, "撮合已达成", `订单 ${order.orderNo} 已进入待执行`);
  await notify(cap.publisherUserId, "撮合已达成", `订单 ${order.orderNo} 已进入待执行`);
  if (publisher?.role === "CARRIER_SUB" && publisher.parentUserId) {
    await notify(publisher.parentUserId, "运力已撮合", `订单 ${order.orderNo} 已进入待执行`);
  }
  await logOp(userId, "SUGGEST_MATCH", "order", order.id);
  return { status: "MATCHED" };
}

export function stripCustomer<T extends Record<string, unknown>>(order: T) {
  const hidden = ["platformFeeVnd", "driverIncomeVnd", "commissionBps"];
  const clone = serializeMoney(order);
  for (const key of hidden) delete clone[key];
  return clone;
}
