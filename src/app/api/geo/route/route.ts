import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { formatRouteLabel, routeEstimate, routePolyline } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return jsonFail("未登录", 401);
  const oLat = Number(req.nextUrl.searchParams.get("oLat"));
  const oLng = Number(req.nextUrl.searchParams.get("oLng"));
  const dLat = Number(req.nextUrl.searchParams.get("dLat"));
  const dLng = Number(req.nextUrl.searchParams.get("dLng"));
  const withGeom = req.nextUrl.searchParams.get("geometry") === "1";
  if (![oLat, oLng, dLat, dLng].every(Number.isFinite)) return jsonFail("坐标不完整");
  const origin = { lat: oLat, lng: oLng };
  const dest = { lat: dLat, lng: dLng };
  const estimate = await routeEstimate(origin, dest);
  const coordinates = withGeom ? await routePolyline(origin, dest) : undefined;
  return jsonOk({
    ...estimate,
    label: formatRouteLabel(estimate),
    coordinates: coordinates || null,
    geometrySource: coordinates?.length ? "osrm" : null,
  });
}
