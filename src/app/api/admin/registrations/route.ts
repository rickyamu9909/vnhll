import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp, notify } from "@/lib/market";

export async function GET() {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const rows = await prisma.user.findMany({
    where: { role: { in: [UserRole.CUSTOMER, UserRole.CARRIER_MAIN] } },
    include: { company: true, carrierProfile: true },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(
    rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      phone: r.phone,
      role: r.role,
      carrierKind: r.carrierKind,
      status: r.status,
      rejectReason: r.rejectReason,
      companyName: r.company?.companyName || r.carrierProfile?.companyName,
      createdAt: r.createdAt,
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const id = String(body.id || "");
  const action = String(body.action || "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role === UserRole.ADMIN) return jsonFail("用户不存在", 404);
  if (action === "approve") {
    await prisma.user.update({ where: { id }, data: { status: UserStatus.ACTIVE, rejectReason: null } });
    await notify(id, "注册已通过", "你的账号已激活，可以登录。");
    await logOp(user!.id, "REGISTER_APPROVE", "user", id);
    return jsonOk({ id, status: "ACTIVE" });
  }
  if (action === "reject") {
    const reason = String(body.reason || "").trim();
    if (!reason) return jsonFail("请填写拒绝原因");
    await prisma.user.update({ where: { id }, data: { status: UserStatus.REJECTED, rejectReason: reason } });
    await notify(id, "注册未通过", reason);
    await logOp(user!.id, "REGISTER_REJECT", "user", id, reason);
    return jsonOk({ id, status: "REJECTED" });
  }
  return jsonFail("未知操作");
}
