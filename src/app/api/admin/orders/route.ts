import { NextRequest } from "next/server";
import { OrderStatus, UserRole, UserStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";
import { createPublishedOrder, sweepDeadlines } from "@/lib/market";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  await sweepDeadlines();

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
      customerBidVnd: o.customerBidVnd?.toString() ?? null,
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
    const order = await createPublishedOrder(customer.id, body, user!.id, `管理员代客建单（${customer.username}）`);
    return jsonOk(serializeMoney(order as unknown as Record<string, unknown>));
  } catch (e) {
    return jsonFail((e as Error).message || "创建订单失败，请检查字段");
  }
}
