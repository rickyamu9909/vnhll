import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, VehicleType } from "@prisma/client";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp } from "@/lib/market";

export async function GET() {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  if (user!.role !== "CARRIER_MAIN") return jsonFail("仅主账号可管理司机", 403);
  const [subs, vehicles] = await Promise.all([
    prisma.user.findMany({ where: { parentUserId: user!.id }, select: { id: true, username: true, displayName: true, phone: true, status: true } }),
    prisma.vehicle.findMany({ where: { ownerUserId: user!.id } }),
  ]);
  return jsonOk({ subs, vehicles });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCarrier(user) || user!.role !== "CARRIER_MAIN") return jsonFail("仅主账号可添加司机", 403);
  const me = await prisma.user.findUnique({ where: { id: user!.id } });
  if (me?.carrierKind === "PERSONAL") return jsonFail("个人司机不能添加子账号");
  const body = await req.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!username || !password || !name || !phone) return jsonFail("账号、密码、姓名、电话为必填");
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return jsonFail("账号已存在");
  const created = await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: UserRole.CARRIER_SUB,
      status: UserStatus.ACTIVE,
      carrierKind: "SUB",
      parentUserId: user!.id,
      displayName: name,
      phone,
    },
  });
  if (body.plateNumber) {
    await prisma.vehicle.create({
      data: {
        ownerUserId: user!.id,
        assignedUserId: created.id,
        plateNumber: String(body.plateNumber),
        vehicleType: (body.vehicleType as VehicleType) || VehicleType.TON_3_5,
        loadTons: Number(body.loadTons || 3.5),
      },
    });
  }
  await logOp(user!.id, "ADD_SUBDRIVER", "user", created.id);
  return jsonOk({ id: created.id, username: created.username });
}
