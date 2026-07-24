import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const status = req.nextUrl.searchParams.get("status") as UserStatus | null;
  const customers = await prisma.user.findMany({
    where: {
      role: UserRole.CUSTOMER,
      ...(status ? { status } : {}),
    },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(
    customers.map((c) => ({
      id: c.id,
      username: c.username,
      displayName: c.displayName,
      phone: c.phone,
      status: c.status,
      rejectReason: c.rejectReason,
      createdAt: c.createdAt,
      company: c.company,
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id) return jsonFail("缺少客户ID");

  const customer = await prisma.user.findFirst({
    where: { id, role: UserRole.CUSTOMER },
  });
  if (!customer) return jsonFail("客户不存在", 404);

  if (action === "approve") {
    const updated = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, rejectReason: null },
    });
    return jsonOk({ id: updated.id, status: updated.status });
  }

  if (action === "reject") {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.REJECTED,
        rejectReason: String(body.reason || "审核拒绝"),
      },
    });
    return jsonOk({ id: updated.id, status: updated.status });
  }

  if (action === "disable") {
    const updated = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.DISABLED },
    });
    return jsonOk({ id: updated.id, status: updated.status });
  }

  return jsonFail("未知操作");
}
