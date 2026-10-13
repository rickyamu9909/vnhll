import { NextRequest } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true, orderNo: true } });
  if (!order) return jsonFail("订单不存在", 404);
  const [operations, statusLogs] = await Promise.all([
    prisma.operationLog.findMany({
      where: { targetType: "order", targetId: params.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orderStatusLog.findMany({
      where: { orderId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return jsonOk({ orderNo: order.orderNo, operations, statusLogs });
}
