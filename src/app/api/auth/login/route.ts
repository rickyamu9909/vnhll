import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signToken } from "@/lib/auth";
import { jsonFail, jsonOk } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) return jsonFail("用户名或密码不能为空");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return jsonFail("账号或密码错误", 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return jsonFail("账号或密码错误", 401);

  if (user.status === UserStatus.PENDING) {
    return jsonFail("账号待审核，请联系管理员", 403);
  }
  if (user.status === UserStatus.REJECTED) {
    return jsonFail(`账号已拒绝：${user.rejectReason || ""}`, 403);
  }
  if (user.status === UserStatus.DISABLED) {
    return jsonFail("账号已停用", 403);
  }

  const session = {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    displayName: user.displayName,
    locale: user.locale,
    phone: user.phone,
  };
  const token = await signToken(session);
  await setAuthCookie(token);

  return jsonOk({
    ...session,
    redirectTo: user.role === "ADMIN" ? "/admin" : "/orders",
  });
}
