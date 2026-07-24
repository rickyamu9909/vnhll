import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const companyName = String(body.companyName || "").trim();
  const contactName = String(body.contactName || "").trim();
  const contactPhone = String(body.contactPhone || "").trim();
  const taxCode = String(body.taxCode || "").trim();
  const address = String(body.address || "").trim();

  if (!username || !password || !companyName) {
    return jsonFail("用户名、密码、企业名称为必填");
  }
  if (password.length < 6) return jsonFail("密码至少6位");

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return jsonFail("用户名已存在");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: UserRole.CUSTOMER,
      status: UserStatus.PENDING,
      displayName: companyName,
      phone: contactPhone || null,
      company: {
        create: {
          companyName,
          taxCode: taxCode || null,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          address: address || null,
        },
      },
    },
    include: { company: true },
  });

  return jsonOk({
    id: user.id,
    username: user.username,
    status: user.status,
    message: "注册成功，请等待管理员审核",
  });
}
