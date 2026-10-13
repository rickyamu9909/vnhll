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
  const originAddress = String(body.originAddress || body.pickupAddress || "").trim();
  const destAddress = String(body.destAddress || body.deliveryAddress || "").trim();
  if (!originContact || !originPhone || !destContact || !destPhone) {
    throw new Error("起运和目的联系人、电话均为必填");
  }
  if (!originAddress || !destAddress) throw new Error("起运地和目的地详细地址为必填");
  const originProvince = String(body.originProvince || "").trim();
  const originCity = String(body.originCity || "").trim();
  const destProvince = String(body.destProvince || "").trim();
  const destCity = String(body.destCity || "").trim();
  assertOrderRegion(originProvince, originCity, "起运");
  assertOrderRegion(destProvince, destCity, "目的");
  const items = Array.isArray(body.cargoItems) ? (body.cargoItems as CargoItemInput[]) : [];
  if (!items.length) throw new Error("请至少填写一行货物尺寸");
  const weightTons = Number(body.weightTons);
  if (!Number.isFinite(weightTons) || weightTons <= 0) throw new Error("请填写货物重量（吨）");
  const pickupAt = new Date(String(body.pickupAt || ""));
  const etaAt = new Date(String(body.etaAt || ""));
  if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(etaAt.getTime())) throw new Error("请填写预约接货和预计送达时间");
  const targetRaw = body.targetPriceVnd;
  const targetPriceVnd =
    targetRaw === null || targetRaw === undefined || targetRaw === "" ? null : toBigIntMoney(targetRaw as number | string);
  return {
    originProvince: String(body.originProvince || "").trim(),
    originCity: String(body.originCity || "").trim(),
    originAddress,
    originContact,
    originPhone,
    destProvince: String(body.destProvince || "").trim(),
    destCity: String(body.destCity || "").trim(),
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
    items: items.map((it) => ({
      lengthCm: Number(it.lengthCm),
      widthCm: Number(it.widthCm),
      heightCm: Number(it.heightCm),
      quantity: Number(it.quantity) || 1,
    })),
  };
}

function shipmentData(parsed: ReturnType<typeof parseOrderBody>, extra: Record<string, unknown>) {
  const cargoName = parsed.items.map((i) => `${i.lengthCm}x${i.widthCm}x${i.heightCm}cm x${i.quantity}`).join("; ");
  return {
    pickupAddress: [parsed.originProvince, parsed.originCity, parsed.originAddress].filter(Boolean).join(" "),
    pickupContact: parsed.originContact,
    pickupPhone: parsed.originPhone,
    pickupNote: parsed.note,
    pickupAt: parsed.pickupAt,
    deliveryAddress: [parsed.destProvince, parsed.destCity, parsed.destAddress].filter(Boolean).join(" "),
    deliveryContact: parsed.destContact,
    deliveryPhone: parsed.destPhone,
    cargoName: cargoName || "货物",
    cargoWeightKg: parsed.weightTons * 1000,
    cargoVolumeM3: parsed.items.reduce((s, i) => s + (i.lengthCm * i.widthCm * i.heightCm * i.quantity) / 1_000_000, 0),
    vehicleType: parsed.vehicleType,
    originProvince: parsed.originProvince,
    originCity: parsed.originCity,
    originAddress: parsed.originAddress,
    destProvince: parsed.destProvince,
    destCity: parsed.destCity,
    destAddress: parsed.destAddress,
    cargoType: parsed.cargoType,
    packaging: parsed.packaging,
    weightTons: parsed.weightTons,
    etaAt: parsed.etaAt,
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
  return updated;
}

function lowestBid<T extends { priceVnd: bigint; createdAt: Date }>(bids: T[]) {
  return [...bids].sort((a, b) => (a.priceVnd < b.priceVnd ? -1 : a.priceVnd > b.priceVnd ? 1 : a.createdAt.getTime() - b.createdAt.getTime()))[0];
}

export async function sweepDeadlines() {
  const cfg = await getConfig();
  const now = new Date();
  const open = await prisma.order.findMany({
    where: { status: OrderStatus.OPEN, matchPath: { in: [MatchPath.A, MatchPath.B] } },
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
        status: OrderStatus.PENDING_AUDIT,
        acceptedByUserId: best.bidderUserId,
        auditDeadline: addMinutes(now, cfg.auditMinutes),
        ...moneyFields(best.priceVnd, bps),
        statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_AUDIT, note: "客户确认超时，默认最低价" } },
      },
    });
  }

  const audits = await prisma.order.findMany({
    where: { status: { in: [OrderStatus.LOCKED, OrderStatus.PENDING_AUDIT] }, auditDeadline: { lte: now } },
  });
  for (const order of audits) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PENDING_EXECUTION,
        rejectReason: null,
        statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_EXECUTION, note: "平台审核超时自动通过" } },
      },
    });
    await logOp(null, "AUDIT_AUTO_PASS", "order", order.id, "超时自动通过");
  }

  await prisma.capacityNegotiation.updateMany({
    where: { status: NegotiationStatus.PENDING, respondDeadline: { lte: now } },
    data: { status: NegotiationStatus.EXPIRED },
  });
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
      status: OrderStatus.LOCKED,
      acceptedByUserId: userId,
      auditDeadline: addMinutes(new Date(), cfg.auditMinutes),
      ...moneyFields(order.targetPriceVnd, bps),
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.LOCKED, note: "主账号接单锁定", operatorId: userId } },
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
      status: OrderStatus.PENDING_AUDIT,
      acceptedByUserId: bid.bidderUserId,
      auditDeadline: addMinutes(new Date(), cfg.auditMinutes),
      ...moneyFields(bid.priceVnd, bps),
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.PENDING_AUDIT, note: "客户确认报价", operatorId: customerId } },
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
      statusLogs: { create: { fromStatus: order.status, toStatus: next, note: "履约状态推进", operatorId: userId } },
    },
  });
  await logOp(userId, "ORDER_ADVANCE", "order", orderId, next);
  return updated;
}

export async function customerComplete(orderId: string, customerId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId, status: OrderStatus.DELIVERED } });
  if (!order) throw new Error("仅已送达订单可确认完成");
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
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
  return prisma.order.update({
    where: { id: orderId },
    data: {
      ...data,
      cargoItems: { create: parsed.items },
      statusLogs: { create: { fromStatus: order.status, toStatus: OrderStatus.OPEN, note: "客户修改后重新发布", operatorId: customerId } },
    },
  });
}

export async function createCapacity(publisherUserId: string, body: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: publisherUserId } });
  if (!user || (user.role !== "CARRIER_MAIN" && user.role !== "CARRIER_SUB")) throw new Error("无权发布运力");
  const expected = toBigIntMoney(body.expectedPriceVnd as number);
  const row = await prisma.capacity.create({
    data: {
      publisherUserId,
      location: String(body.location || "").trim(),
      availableFrom: new Date(String(body.availableFrom)),
      availableTo: new Date(String(body.availableTo)),
      destPreference: body.destPreference ? String(body.destPreference) : null,
      vehicleType: body.vehicleType as VehicleType,
      loadTons: Number(body.loadTons),
      cargoTypes: String(body.cargoTypes || "GENERAL"),
      airportOk: Boolean(body.airportOk),
      portOk: Boolean(body.portOk),
      expectedPriceVnd: expected,
      note: body.note ? String(body.note) : null,
    },
  });
  await logOp(publisherUserId, "CAPACITY_CREATE", "capacity", row.id);
  return row;
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
      etaAt: parsed.etaAt,
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
      status: OrderStatus.PENDING_AUDIT,
      matchPath: MatchPath.C,
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
      auditDeadline: addMinutes(new Date(), cfg.auditMinutes),
      ...moneyFields(neg.priceVnd, bps),
      statusLogs: { create: { toStatus: OrderStatus.PENDING_AUDIT, note: "运力匹配进入平台审核", operatorId: actorId } },
    },
  });
  await prisma.capacityNegotiation.update({ where: { id: negId }, data: { status: NegotiationStatus.ACCEPTED, orderId: order.id } });
  await prisma.capacity.update({ where: { id: neg.capacityId }, data: { status: "MATCHED" } });
  if (publisher?.role === "CARRIER_SUB" && publisher.parentUserId) {
    await notify(publisher.parentUserId, "运力协商已接受", `司机已接受协商，订单 ${order.orderNo} 进入平台审核`);
  }
  await logOp(actorId, "CAPACITY_MATCH", "order", order.id);
  return order;
}

export async function matchCapacity(capacityId: string, customerId: string, body: Record<string, unknown>) {
  const cap = await prisma.capacity.findUnique({ where: { id: capacityId } });
  if (!cap || cap.status !== "OPEN") throw new Error("运力不可匹配");
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

export function stripCustomer<T extends Record<string, unknown>>(order: T) {
  const hidden = ["platformFeeVnd", "driverIncomeVnd", "commissionBps"];
  const clone = serializeMoney(order);
  for (const key of hidden) delete clone[key];
  return clone;
}
