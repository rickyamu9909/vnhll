import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { parseSavedAddress } from "@/lib/saved-address";

const LIMIT = 30;

async function customerIdOf(req: NextRequest, body?: Record<string, unknown>) {
  const fromQuery = req.nextUrl.searchParams.get("userId");
  const id = String(body?.userId || fromQuery || "").trim();
  if (!id) return null;
  const customer = await prisma.user.findFirst({ where: { id, role: UserRole.CUSTOMER } });
  return customer?.id || null;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const userId = await customerIdOf(req);
  if (!userId) return jsonFail("请选择客户");
  const rows = await prisma.savedAddress.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const userId = await customerIdOf(req, body);
  if (!userId) return jsonFail("请选择客户");
  try {
    const parsed = parseSavedAddress(body);
    const count = await prisma.savedAddress.count({ where: { userId } });
    if (count >= LIMIT) return jsonFail("常用地址最多保存 30 条");
    const row = await prisma.savedAddress.create({ data: { userId, ...parsed } });
    return jsonOk(row);
  } catch (e) {
    return jsonFail((e as Error).message || "保存失败");
  }
}
