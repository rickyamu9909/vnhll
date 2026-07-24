import { NextRequest } from "next/server";
import { VehicleType, OrderStatus } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { genOrderNo } from "@/lib/order";
import { toBigIntMoney, serializeMoney } from "@/lib/money";

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const orders = await prisma.order.findMany({
    where: { customerId: user!.id },
    include: {
      matchedDriver: { select: { name: true, plateNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const showDriver = new Set(["MATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED"]);

  const data = orders.map((o) => {
    const { dealPriceVnd, platformFeeVnd, driverIncomeVnd, matchedDriver, ...rest } = o;
    void dealPriceVnd;
    void platformFeeVnd;
    void driverIncomeVnd;
    return serializeMoney({
      ...rest,
      matchedDriver: showDriver.has(o.status) && matchedDriver
        ? { name: matchedDriver.name, plateNumber: matchedDriver.plateNumber }
        : null,
    });
  });

  return jsonOk(data);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  try {
    const order = await prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        customerId: user!.id,
        status: OrderStatus.PENDING_REVIEW,
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
        bidDeadline: body.bidDeadline ? new Date(body.bidDeadline) : null,
        statusLogs: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PENDING_REVIEW,
            note: "客户创建订单",
            operatorId: user!.id,
          },
        },
      },
    });

    const { dealPriceVnd, platformFeeVnd, driverIncomeVnd, ...safe } = order;
    void dealPriceVnd;
    void platformFeeVnd;
    void driverIncomeVnd;
    return jsonOk(serializeMoney(safe));
  } catch (e) {
    console.error(e);
    return jsonFail("创建订单失败，请检查字段");
  }
}
