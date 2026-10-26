import { OrderStatus } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { scoreRouteFit, scoreLevelLabel } from "@/lib/route-score";

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const [rows, openOrder] = await Promise.all([
    prisma.capacity.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { publisher: { select: { displayName: true, username: true, carrierKind: true } } },
    }),
    prisma.order.findFirst({
      where: { customerId: user!.id, status: { in: [OrderStatus.OPEN, OrderStatus.BIDDING] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const scored = rows.map((r) => {
    const fit = openOrder
      ? scoreRouteFit({
          orderOrigin: openOrder.originLat != null && openOrder.originLng != null ? { lat: openOrder.originLat, lng: openOrder.originLng } : null,
          orderDest: openOrder.destLat != null && openOrder.destLng != null ? { lat: openOrder.destLat, lng: openOrder.destLng } : null,
          pickupAt: openOrder.pickupAt,
          vehicleType: openOrder.vehicleType,
          weightTons: openOrder.weightTons,
          cargoType: openOrder.cargoType,
          capLocation: r.locationLat != null && r.locationLng != null ? { lat: r.locationLat, lng: r.locationLng } : null,
          capDest: r.destLat != null && r.destLng != null ? { lat: r.destLat, lng: r.destLng } : null,
          availableFrom: r.availableFrom,
          availableTo: r.availableTo,
          capVehicleType: r.vehicleType,
          loadTons: r.loadTons,
          cargoTypes: r.cargoTypes,
          airportOk: r.airportOk,
          portOk: r.portOk,
        })
      : null;
    return {
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
      score: fit?.score ?? 0,
      scoreLevel: fit ? scoreLevelLabel(fit.level) : null,
      reason: fit?.reason || null,
      distanceKm: fit?.distanceKm ?? null,
    };
  });
  scored.sort((a, b) => b.score - a.score || 0);
  return jsonOk(scored);
}
