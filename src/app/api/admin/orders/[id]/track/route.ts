import { NextRequest } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { readOrderTrack } from "@/lib/track-store";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const track = await readOrderTrack(params.id);
  if (!track) return jsonFail("订单不存在", 404);
  return jsonOk(track);
}
