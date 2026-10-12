import { NextRequest } from "next/server";
import { getSession, requireCustomer } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { matchCapacity } from "@/lib/market";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  try {
    const result = await matchCapacity(params.id, user!.id, await req.json());
    return jsonOk(result);
  } catch (e) {
    return jsonFail((e as Error).message || "匹配失败");
  }
}
