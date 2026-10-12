import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { respondNegotiation } from "@/lib/market";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  try {
    const result = await respondNegotiation(params.id, user!.id, Boolean(body.accept));
    return jsonOk(result);
  } catch (e) {
    return jsonFail((e as Error).message || "处理失败");
  }
}
