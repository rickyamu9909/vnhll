import { NextRequest } from "next/server";
import { OrderStatus, UserRole, UserStatus, VehicleType } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { genOrderNo } from "@/lib/order";
import { serializeMoney, toBigIntMoney } from "@/lib/money";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const status = req.nextUrl.searchParams.get("status") as OrderStatus | null;
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: {
      customer: { select: { id: true, username: true, displayName: true, company: true } },
      matchedDriver: true,
      bids: { include: { driver: true }, orderBy: { priceVnd: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(
    orders.map((o) => ({
      ...serializeMoney(o as unknown as Record<string, unknown>),
      customerBidVnd: o.customerBidVnd.toString(),
      dealPriceVnd: o.dealPriceVnd?.toString() ?? null,
      platformFeeVnd: o.platformFeeVnd?.toString() ?? null,
      driverIncomeVnd: o.driverIncomeVnd?.toString() ?? null,
      bids: o.bids.map((b) => ({
        ...b,
        priceVnd: b.priceVnd.toString(),
      })),
    }))
  );
}

/** 管理员代客建单：选择客户后创建，订单归属该客户 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const customerId = String(body.customerId || "").trim();
  if (!customerId) return jsonFail("请选择客户账号");

  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
  });
  if (!customer) return jsonFail("客户不存在或未激活");

  try {
    const order = await prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        customerId: customer.id,
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
            note: `管理员代客建单（客户：${customer.username}）`,
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
