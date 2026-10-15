import { NextRequest } from "next/server";
import { MatchPath, OrderStatus, Prisma, UserRole, UserStatus, VehicleType } from "@prisma/client";
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
  const customerId = req.nextUrl.searchParams.get("customerId");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const customer = req.nextUrl.searchParams.get("customer")?.trim();
  const origin = req.nextUrl.searchParams.get("origin")?.trim();
  const dest = req.nextUrl.searchParams.get("dest")?.trim();
  const phone = req.nextUrl.searchParams.get("phone")?.trim();
  const cargo = req.nextUrl.searchParams.get("cargo")?.trim();
  const path = req.nextUrl.searchParams.get("path")?.trim();
  const vehicle = req.nextUrl.searchParams.get("vehicle")?.trim();
  const dateFrom = req.nextUrl.searchParams.get("dateFrom");
  const dateTo = req.nextUrl.searchParams.get("dateTo");
  const and: Prisma.OrderWhereInput[] = [];
  if (status) and.push({ status });
  if (customerId) and.push({ customerId });
  if (q) and.push({ orderNo: { contains: q, mode: "insensitive" } });
  if (customer) {
    and.push({
      customer: {
        OR: [
          { username: { contains: customer, mode: "insensitive" } },
          { displayName: { contains: customer, mode: "insensitive" } },
          { company: { companyName: { contains: customer, mode: "insensitive" } } },
        ],
      },
    });
  }
  if (origin) {
    and.push({
      OR: [
        { originProvince: { contains: origin, mode: "insensitive" } },
        { originCity: { contains: origin, mode: "insensitive" } },
        { originAddress: { contains: origin, mode: "insensitive" } },
        { pickupAddress: { contains: origin, mode: "insensitive" } },
        { pickupContact: { contains: origin, mode: "insensitive" } },
      ],
    });
  }
  if (dest) {
    and.push({
      OR: [
        { destProvince: { contains: dest, mode: "insensitive" } },
        { destCity: { contains: dest, mode: "insensitive" } },
        { destAddress: { contains: dest, mode: "insensitive" } },
        { deliveryAddress: { contains: dest, mode: "insensitive" } },
        { deliveryContact: { contains: dest, mode: "insensitive" } },
      ],
    });
  }
  if (phone) {
    and.push({
      OR: [
        { pickupPhone: { contains: phone } },
        { deliveryPhone: { contains: phone } },
      ],
    });
  }
  if (cargo) and.push({ cargoName: { contains: cargo, mode: "insensitive" } });
  if (path) {
    const text = path.toUpperCase();
    const code = text === "A" || path.includes("出价") ? MatchPath.A : text === "B" || path.includes("询价") || path.includes("报价") ? MatchPath.B : text === "C" || path.includes("运力") ? MatchPath.C : null;
    if (code) and.push({ matchPath: code });
  }
  if (vehicle) {
    const types = new Set((Object.values(VehicleType) as string[]).filter((item) => item.toLowerCase().includes(vehicle.toLowerCase())));
    if (vehicle.includes("1.5")) types.add(VehicleType.TON_1_5);
    if (vehicle.includes("3.5")) types.add(VehicleType.TON_3_5);
    if (vehicle.includes("7")) types.add(VehicleType.TON_7);
    if (vehicle.includes("10")) types.add(VehicleType.TON_10);
    if (types.size) and.push({ vehicleType: { in: [...types] as VehicleType[] } });
  }
  if (dateFrom || dateTo) {
    and.push({
      pickupAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      },
    });
  }
  const orders = await prisma.order.findMany({
    where: and.length ? { AND: and } : undefined,
    include: {
      customer: { select: { id: true, username: true, displayName: true, company: true } },
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
