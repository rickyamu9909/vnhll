import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { closeCapacity, updateCapacity } from "@/lib/market";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const row = await prisma.capacity.findFirst({
    where: { id: params.id, publisherUserId: user!.id },
    include: { negotiations: { orderBy: { createdAt: "desc" } } },
  });
  if (!row) return jsonFail("运力不存在", 404);
  const orderId = row.negotiations.find((item) => item.orderId)?.orderId || null;
  return jsonOk({
    ...row,
    expectedPriceVnd: row.expectedPriceVnd.toString(),
    orderId,
    negotiations: row.negotiations.map((item) => ({ ...item, priceVnd: item.priceVnd.toString() })),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  try {
    const row = await updateCapacity(params.id, user!.id, await req.json());
    return jsonOk({ id: row.id });
  } catch (error) {
    return jsonFail((error as Error).message || "保存失败");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json().catch(() => ({}));
  if (String(body.action || "") !== "cancel") return jsonFail("未知操作");
  try {
    const row = await closeCapacity(params.id, user!.id);
    return jsonOk({ id: row.id, status: row.status });
  } catch (error) {
    return jsonFail((error as Error).message || "取消失败");
  }
}
