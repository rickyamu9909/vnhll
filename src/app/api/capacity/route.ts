import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.capacity.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: { publisher: { select: { displayName: true, username: true, carrierKind: true } } },
  });
  return jsonOk(
    rows.map((r) => ({
      id: r.id,
      location: r.location,
      availableFrom: r.availableFrom,
      availableTo: r.availableTo,
      destPreference: r.destPreference,
      vehicleType: r.vehicleType,
      loadTons: r.loadTons,
      cargoTypes: r.cargoTypes,
      airportOk: r.airportOk,
      portOk: r.portOk,
      expectedPriceVnd: r.expectedPriceVnd.toString(),
      note: r.note,
      publisherName: r.publisher.displayName || r.publisher.username,
    }))
  );
}
