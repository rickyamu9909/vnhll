import { NextRequest } from "next/server";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

type Ctx = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const row = await prisma.savedAddress.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!row) return jsonFail("地址不存在", 404);
  await prisma.savedAddress.delete({ where: { id: row.id } });
  return jsonOk({ id: row.id });
}
