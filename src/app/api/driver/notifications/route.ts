import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.notification.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const markAll = Boolean(body.all);
  if (markAll) {
    await prisma.notification.updateMany({ where: { userId: user!.id, read: false }, data: { read: true } });
  } else if (ids.length) {
    await prisma.notification.updateMany({ where: { userId: user!.id, id: { in: ids } }, data: { read: true } });
  } else {
    return jsonFail("缺少通知 id");
  }
  return jsonOk({ ok: true });
}
