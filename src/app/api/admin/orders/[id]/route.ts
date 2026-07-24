import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { calcCommission, serializeMoney, toBigIntMoney } from "@/lib/money";
import { buildDriverNotifyMessage } from "@/lib/notify";
import { ORDER_STATUS_FLOW } from "@/lib/order";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: { include: { company: true } },
      matchedDriver: true,
      bids: { include: { driver: true }, orderBy: { createdAt: "asc" } },
      statusLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return jsonFail("订单不存在", 404);

  const hotline = process.env.ADMIN_HOTLINE || user!.phone || "+84 90 000 0000";
  const notifyText = buildDriverNotifyMessage(order, hotline);

  return jsonOk({
    ...serializeMoney(order as unknown as Record<string, unknown>),
    customerBidVnd: order.customerBidVnd.toString(),
    dealPriceVnd: order.dealPriceVnd?.toString() ?? null,
    platformFeeVnd: order.platformFeeVnd?.toString() ?? null,
    driverIncomeVnd: order.driverIncomeVnd?.toString() ?? null,
    bids: order.bids.map((b) => ({ ...b, priceVnd: b.priceVnd.toString() })),
    notifyText,
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const action = String(body.action || "");

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return jsonFail("订单不存在", 404);

  if (action === "approve") {
    if (order.status !== OrderStatus.PENDING_REVIEW) return jsonFail("当前状态不可审核");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.BIDDING,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.BIDDING,
            note: "管理员审核通过，进入竞价",
            operatorId: user!.id,
          },
        },
      },
    });
    return jsonOk(serializeMoney(updated as unknown as Record<string, unknown>));
  }

  if (action === "reject") {
    if (order.status !== OrderStatus.PENDING_REVIEW) return jsonFail("当前状态不可拒绝");
    const reason = String(body.reason || "审核拒绝");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.REJECTED,
        rejectReason: reason,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.REJECTED,
            note: reason,
            operatorId: user!.id,
          },
        },
      },
    });
    return jsonOk(serializeMoney(updated as unknown as Record<string, unknown>));
  }

  if (action === "add_bid") {
    if (order.status !== OrderStatus.BIDDING && order.status !== OrderStatus.MATCHED) {
      return jsonFail("仅竞价中/已接单可录入报价");
    }
    const driverId = String(body.driverId || "");
    const priceVnd = toBigIntMoney(body.priceVnd);
    const note = body.note ? String(body.note) : null;
    if (!driverId) return jsonFail("请选择司机");

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver || driver.status !== "ACTIVE") return jsonFail("司机不可用");

    const bid = await prisma.orderBid.upsert({
      where: { orderId_driverId: { orderId: order.id, driverId } },
      create: { orderId: order.id, driverId, priceVnd, note },
      update: { priceVnd, note },
      include: { driver: true },
    });

    return jsonOk({ ...bid, priceVnd: bid.priceVnd.toString() });
  }

  if (action === "match") {
    if (order.status !== OrderStatus.BIDDING) return jsonFail("仅竞价中可匹配");
    const driverId = String(body.driverId || "");
    if (!driverId) return jsonFail("请选择成交司机");

    const bid = await prisma.orderBid.findUnique({
      where: { orderId_driverId: { orderId: order.id, driverId } },
    });
    if (!bid) return jsonFail("请先为该司机录入报价");

    const { platformFeeVnd, driverIncomeVnd } = calcCommission(bid.priceVnd);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.MATCHED,
        matchedDriverId: driverId,
        dealPriceVnd: bid.priceVnd,
        platformFeeVnd,
        driverIncomeVnd,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.MATCHED,
            note: `匹配司机，成交价 ${bid.priceVnd.toString()} VND，佣金15%`,
            operatorId: user!.id,
          },
        },
      },
      include: { matchedDriver: true },
    });

    return jsonOk({
      ...serializeMoney(updated as unknown as Record<string, unknown>),
      dealPriceVnd: updated.dealPriceVnd?.toString(),
      platformFeeVnd: updated.platformFeeVnd?.toString(),
      driverIncomeVnd: updated.driverIncomeVnd?.toString(),
    });
  }

  if (action === "set_status") {
    const toStatus = body.status as OrderStatus;
    const allowed = ORDER_STATUS_FLOW[order.status] || [];
    if (!allowed.includes(toStatus)) {
      return jsonFail(`不可从 ${order.status} 变更到 ${toStatus}`);
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: toStatus,
        adminNote: body.adminNote ? String(body.adminNote) : order.adminNote,
        notifyNote: body.notifyNote ? String(body.notifyNote) : order.notifyNote,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus,
            note: body.note ? String(body.note) : `状态变更为 ${toStatus}`,
            operatorId: user!.id,
          },
        },
      },
    });
    return jsonOk(serializeMoney(updated as unknown as Record<string, unknown>));
  }

  return jsonFail("未知操作");
}
