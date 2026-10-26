import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { formatRouteLabel, routeEstimate } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return jsonFail("未登录", 401);
  const oLat = Number(req.nextUrl.searchParams.get("oLat"));
  const oLng = Number(req.nextUrl.searchParams.get("oLng"));
  const dLat = Number(req.nextUrl.searchParams.get("dLat"));
  const dLng = Number(req.nextUrl.searchParams.get("dLng"));
  if (![oLat, oLng, dLat, dLng].every(Number.isFinite)) return jsonFail("坐标不完整");
  const estimate = await routeEstimate({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  return jsonOk({ ...estimate, label: formatRouteLabel(estimate) });
}
