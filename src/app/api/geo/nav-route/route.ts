import { NextRequest, NextResponse } from "next/server";
import { jsonFail, jsonOk } from "@/lib/api";
import { navRouteCached } from "@/lib/geo";

/** 公开：页内导航用简化路线（含服务端缓存）。跟踪链接免登录也可调用。 */
export async function GET(req: NextRequest) {
  const oLat = Number(req.nextUrl.searchParams.get("oLat"));
  const oLng = Number(req.nextUrl.searchParams.get("oLng"));
  const dLat = Number(req.nextUrl.searchParams.get("dLat"));
  const dLng = Number(req.nextUrl.searchParams.get("dLng"));
  if (![oLat, oLng, dLat, dLng].every(Number.isFinite)) return jsonFail("坐标不完整");

  const result = await navRouteCached({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  if ("error" in result) return jsonFail(result.error, 400);

  const res = jsonOk(result);
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=120");
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
