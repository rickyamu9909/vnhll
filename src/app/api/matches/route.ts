import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.capacityNegotiation.findMany({
    where: { customerId: user!.id },
    include: { capacity: true },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      priceVnd: r.priceVnd.toString(),
      orderId: r.orderId,
      location: r.capacity.location,
      expectedPriceVnd: r.capacity.expectedPriceVnd.toString(),
      createdAt: r.createdAt,
    }))
  );
}
