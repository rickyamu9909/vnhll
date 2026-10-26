import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { searchPlaces } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return jsonFail("未登录", 401);
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return jsonOk([]);
  const hits = await searchPlaces(q, 6);
  return jsonOk(hits);
}
