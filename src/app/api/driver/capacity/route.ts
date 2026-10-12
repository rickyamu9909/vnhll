import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { createCapacity } from "@/lib/market";

export async function GET() {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.capacity.findMany({
    where: { publisherUserId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { negotiations: true },
  });
  return jsonOk(
    rows.map((r) => ({
      ...r,
      expectedPriceVnd: r.expectedPriceVnd.toString(),
      negotiations: r.negotiations.map((n) => ({ ...n, priceVnd: n.priceVnd.toString() })),
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  try {
    const row = await createCapacity(user!.id, await req.json());
    return jsonOk({ ...row, expectedPriceVnd: row.expectedPriceVnd.toString() });
  } catch (e) {
    return jsonFail((e as Error).message || "发布失败");
  }
}
