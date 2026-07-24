import { NextRequest } from "next/server";
import { DriverStatus, VehicleType } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const status = req.nextUrl.searchParams.get("status") as DriverStatus | null;
  const drivers = await prisma.driver.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(drivers);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !phone) return jsonFail("姓名和电话必填");

  const driver = await prisma.driver.create({
    data: {
      name,
      phone,
      vehicleType: (body.vehicleType as VehicleType) || VehicleType.TON_3_5,
      plateNumber: body.plateNumber ? String(body.plateNumber) : null,
      idNumber: body.idNumber ? String(body.idNumber) : null,
      notes: body.notes ? String(body.notes) : null,
      status: body.status === "ACTIVE" ? DriverStatus.ACTIVE : DriverStatus.PENDING,
    },
  });
  return jsonOk(driver);
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return jsonFail("缺少司机ID");

  const action = body.action ? String(body.action) : "update";

  if (action === "approve") {
    const updated = await prisma.driver.update({
      where: { id },
      data: { status: DriverStatus.ACTIVE, rejectReason: null },
    });
    return jsonOk(updated);
  }
  if (action === "reject") {
    const updated = await prisma.driver.update({
      where: { id },
      data: {
        status: DriverStatus.REJECTED,
        rejectReason: String(body.reason || "审核拒绝"),
      },
    });
    return jsonOk(updated);
  }
  if (action === "disable") {
    const updated = await prisma.driver.update({
      where: { id },
      data: { status: DriverStatus.DISABLED },
    });
    return jsonOk(updated);
  }

  const updated = await prisma.driver.update({
    where: { id },
    data: {
      name: body.name !== undefined ? String(body.name) : undefined,
      phone: body.phone !== undefined ? String(body.phone) : undefined,
      vehicleType: body.vehicleType as VehicleType | undefined,
      plateNumber: body.plateNumber !== undefined ? String(body.plateNumber) : undefined,
      idNumber: body.idNumber !== undefined ? String(body.idNumber) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      status: body.status as DriverStatus | undefined,
    },
  });
  return jsonOk(updated);
}
