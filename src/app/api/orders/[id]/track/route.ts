import { NextRequest } from "next/server";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { readOrderTrack } from "@/lib/track-store";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const order = await prisma.order.findFirst({ where: { id: params.id, customerId: user!.id }, select: { id: true } });
  if (!order) return jsonFail("订单不存在", 404);
  const track = await readOrderTrack(order.id);
  return jsonOk(track);
}
