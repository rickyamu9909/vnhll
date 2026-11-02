import { NextRequest } from "next/server";
import { jsonFail, jsonOk } from "@/lib/api";
import { findOrderByCrewToken } from "@/lib/crew";
import { saveCrewTrackReports } from "@/lib/track-store";
import { TRACK_START_STAGES, shareOnForStatus } from "@/lib/track";

type Ctx = { params: { token: string } };

const OPEN = new Set(["PENDING_EXECUTION", "IN_TRANSIT", "MATCHED"]);
const ACTIVE = new Set([...TRACK_START_STAGES, "issue"]);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const order = await findOrderByCrewToken(params.token);
  if (!order) return jsonFail("链接无效或已失效", 404);
  const active =
    order.trackShareOn &&
    OPEN.has(order.status) &&
    !!order.driverStage &&
    ACTIVE.has(order.driverStage) &&
    shareOnForStatus(order.status);
  return jsonOk(active ? [{ id: order.id, orderNo: order.orderNo, status: order.status }] : []);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const order = await findOrderByCrewToken(params.token);
  if (!order) return jsonFail("链接无效或已失效", 404);
  const body = await req.json().catch(() => ({}));
  const reports = Array.isArray(body.reports) ? body.reports : [];
  const result = await saveCrewTrackReports(order.id, reports);
  return jsonOk(result);
}
