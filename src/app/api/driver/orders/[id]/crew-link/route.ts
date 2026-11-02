import { NextRequest } from "next/server";
import { getSession, requireCarrier } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { ensureCrewTrackToken, publicOrigin } from "@/lib/crew";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  try {
    const token = await ensureCrewTrackToken(params.id, user!.id);
    const url = `${publicOrigin(req)}/crew/${token}`;
    return jsonOk({ token, url, path: `/crew/${token}` });
  } catch (e) {
    return jsonFail((e as Error).message || "生成失败");
  }
}
