import { NextRequest } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";
import { getConfig, logOp } from "@/lib/market";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  return jsonOk(await getConfig());
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const updated = await prisma.systemConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {
      commissionBps: Number(body.commissionBps),
      confirmTimerStart: String(body.confirmTimerStart || "AFTER_BID_DEADLINE"),
      confirmMinutes: Number(body.confirmMinutes),
      waitMatchHours: Number(body.waitMatchHours),
      extendHours: Number(body.extendHours),
      maxExtends: Number(body.maxExtends),
      auditMinutes: Number(body.auditMinutes),
      bidLeadHours: Number(body.bidLeadHours),
      negotiateMinutes: Number(body.negotiateMinutes),
    },
  });
  await logOp(user!.id, "CONFIG_UPDATE", "config", "default");
  return jsonOk(updated);
}
