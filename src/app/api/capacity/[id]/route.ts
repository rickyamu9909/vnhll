import { NextRequest } from "next/server";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { capacityMatchBlock } from "@/lib/places";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const row = await prisma.capacity.findUnique({ where: { id: params.id } });
  if (!row) return jsonOk({ id: params.id, status: null, block: capacityMatchBlock(null) });
  return jsonOk({
    id: row.id,
    status: row.status,
    location: row.location,
    expectedPriceVnd: row.expectedPriceVnd.toString(),
    block: capacityMatchBlock(row.status),
  });
}
