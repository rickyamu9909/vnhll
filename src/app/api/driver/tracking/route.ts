import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { activeTrackOrders, saveTrackReports } from "@/lib/track-store";

export async function GET() {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const orders = await activeTrackOrders(user!.id);
  return jsonOk(orders);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json().catch(() => ({}));
  const reports = Array.isArray(body.reports) ? body.reports : [];
  const result = await saveTrackReports(user!.id, reports);
  return jsonOk(result);
}
