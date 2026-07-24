import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";

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
