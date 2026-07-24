import { NextRequest } from "next/server";
import { OrderStatus, VehicleType } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney, toBigIntMoney } from "@/lib/money";

type Ctx = { params: { id: string } };

const SHOW_DRIVER_STATUSES: OrderStatus[] = [
  OrderStatus.MATCHED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

function toCustomerOrder(order: {
  dealPriceVnd: bigint | null;
  platformFeeVnd: bigint | null;
  driverIncomeVnd: bigint | null;
  matchedDriverId: string | null;
  status: OrderStatus;
  matchedDriver?: { name: string; plateNumber: string | null } | null;
  [key: string]: unknown;
}) {
  const { dealPriceVnd, platformFeeVnd, driverIncomeVnd, matchedDriver, ...rest } = order;
  void dealPriceVnd;
  void platformFeeVnd;
  void driverIncomeVnd;

  const showDriver = SHOW_DRIVER_STATUSES.includes(order.status) && matchedDriver;
  return serializeMoney({
    ...rest,
    matchedDriver: showDriver
      ? { name: matchedDriver.name, plateNumber: matchedDriver.plateNumber }
      : null,
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
    include: {
      matchedDriver: { select: { name: true, plateNumber: true } },
    },
  });
  if (!order) return jsonFail("订单不存在", 404);

  return jsonOk(toCustomerOrder(order));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
  });
  if (!order) return jsonFail("订单不存在", 404);

  if (order.status !== OrderStatus.PENDING_REVIEW) {
    return jsonFail("仅待审核订单可修改");
  }

  const body = await req.json();
  try {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        pickupAddress: String(body.pickupAddress || "").trim(),
        pickupContact: String(body.pickupContact || "").trim(),
        pickupPhone: String(body.pickupPhone || "").trim(),
        pickupNote: body.pickupNote ? String(body.pickupNote) : null,
        pickupAt: new Date(body.pickupAt),
        deliveryAddress: String(body.deliveryAddress || "").trim(),
        deliveryContact: String(body.deliveryContact || "").trim(),
        deliveryPhone: String(body.deliveryPhone || "").trim(),
        cargoName: String(body.cargoName || "").trim(),
        cargoWeightKg: Number(body.cargoWeightKg),
        cargoVolumeM3: Number(body.cargoVolumeM3),
        vehicleType: body.vehicleType as VehicleType,
        customerBidVnd: toBigIntMoney(body.customerBidVnd),
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: order.status,
            note: "客户修改订单",
            operatorId: user!.id,
          },
        },
      },
      include: {
        matchedDriver: { select: { name: true, plateNumber: true } },
      },
    });
    return jsonOk(toCustomerOrder(updated));
  } catch (e) {
    console.error(e);
    return jsonFail("修改失败，请检查字段");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const action = String(body.action || "");

  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
    include: {
      matchedDriver: { select: { name: true, plateNumber: true } },
    },
  });
  if (!order) return jsonFail("订单不存在", 404);

  if (action === "cancel") {
    if (![OrderStatus.PENDING_REVIEW, OrderStatus.BIDDING].includes(order.status)) {
      return jsonFail("当前状态不可取消");
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.CANCELLED,
            note: "客户取消订单",
            operatorId: user!.id,
          },
        },
      },
      include: {
        matchedDriver: { select: { name: true, plateNumber: true } },
      },
    });
    return jsonOk(toCustomerOrder(updated));
  }

  if (action === "confirm_complete") {
    if (order.status !== OrderStatus.DELIVERED) {
      return jsonFail("仅已送达订单可确认完成");
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED,
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: OrderStatus.COMPLETED,
            note: "客户确认完成",
            operatorId: user!.id,
          },
        },
      },
      include: {
        matchedDriver: { select: { name: true, plateNumber: true } },
      },
    });
    return jsonOk(toCustomerOrder(updated));
  }

  return jsonFail("未知操作");
}
