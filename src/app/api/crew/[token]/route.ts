import { NextRequest } from "next/server";
import { jsonFail, jsonOk } from "@/lib/api";
import { findOrderByCrewToken, serializeCrewOrder } from "@/lib/crew";
import { cancelDriverStage, setDriverStage } from "@/lib/market";

type Ctx = { params: { token: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const order = await findOrderByCrewToken(params.token);
  if (!order) return jsonFail("链接无效或已失效", 404);
  return jsonOk(serializeCrewOrder(order as unknown as Record<string, unknown>));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const order = await findOrderByCrewToken(params.token);
  if (!order) return jsonFail("链接无效或已失效", 404);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    if (action === "stage") {
      return jsonOk(serializeCrewOrder((await setDriverStage(order.id, null, String(body.stage || ""), body.photos, { crew: true })) as unknown as Record<string, unknown>));
    }
    if (action === "stage_cancel") {
      return jsonOk(serializeCrewOrder((await cancelDriverStage(order.id, null, String(body.stage || ""), { crew: true })) as unknown as Record<string, unknown>));
    }
    return jsonFail("未知操作");
  } catch (e) {
    return jsonFail((e as Error).message || "操作失败");
  }
}
