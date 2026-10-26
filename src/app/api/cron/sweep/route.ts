import { NextRequest } from "next/server";
import { jsonFail, jsonOk } from "@/lib/api";
import { sweepDeadlines } from "@/lib/market";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "ants-cron";
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.nextUrl.searchParams.get("token") || "";
  if (token !== secret) return jsonFail("无权", 401);
  await sweepDeadlines(true);
  return jsonOk({ ok: true, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
