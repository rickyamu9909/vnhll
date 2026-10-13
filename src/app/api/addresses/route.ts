import { NextRequest } from "next/server";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { parseSavedAddress } from "@/lib/saved-address";

const LIMIT = 30;

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.savedAddress.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  try {
    const parsed = parseSavedAddress(await req.json());
    const count = await prisma.savedAddress.count({ where: { userId: user!.id } });
    if (count >= LIMIT) return jsonFail("常用地址最多保存 30 条");
    const row = await prisma.savedAddress.create({ data: { userId: user!.id, ...parsed } });
    return jsonOk(row);
  } catch (e) {
    return jsonFail((e as Error).message || "保存失败");
  }
}
