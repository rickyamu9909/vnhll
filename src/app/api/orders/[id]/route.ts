import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
  });
  if (!order) return jsonFail("订单不存在", 404);

  const { dealPriceVnd, platformFeeVnd, driverIncomeVnd, ...rest } = order;
  void dealPriceVnd;
  void platformFeeVnd;
  void driverIncomeVnd;

  return jsonOk(
    serializeMoney({
      ...rest,
      // 客户只看自己的出价，不看成交价
      customerBidVnd: order.customerBidVnd,
    })
  );
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const action = String(body.action || "");

  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
  });
  if (!order) return jsonFail("订单不存在", 404);

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
    });
    const { dealPriceVnd, platformFeeVnd, driverIncomeVnd, ...safe } = updated;
    void dealPriceVnd;
    void platformFeeVnd;
    void driverIncomeVnd;
    return jsonOk(serializeMoney(safe));
  }

  return jsonFail("未知操作");
}
