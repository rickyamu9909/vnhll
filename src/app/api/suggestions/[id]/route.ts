import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { respondSuggestion } from "@/lib/market";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return jsonFail("未登录", 401);
  const body = await req.json().catch(() => ({}));
  try {
    const result = await respondSuggestion(params.id, user.id, Boolean(body.accept));
    return jsonOk(result);
  } catch (error) {
    return jsonFail(error instanceof Error ? error.message : "处理失败");
  }
}
