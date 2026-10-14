import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { DriverStatus, UserRole, UserStatus, VehicleType } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp } from "@/lib/market";

function imageValue(value: unknown, label: string) {
  const text = String(value || "");
  if (!text.startsWith("data:image/")) return `${label}需要上传照片`;
  if (text.length > 250_000) return `${label}图片过大`;
  return "";
}

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
  if (body.mode === "account") {
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const contactPhone = String(body.contactPhone || "").trim();
    const contactName = String(body.contactName || "").trim();
    const kind = String(body.kind || "PERSONAL");
    if (!username || password.length < 6 || !contactPhone || !contactName) return jsonFail("账号、密码、联系人、电话为必填");
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return jsonFail("账号已存在");
    const passwordHash = await bcrypt.hash(password, 10);
    if (kind === "COMPANY") {
      const companyName = String(body.companyName || "").trim();
      const address = String(body.address || "").trim();
      const licenseError = imageValue(body.licenseNo, "营业执照");
      if (!companyName || !address) return jsonFail("公司名称、地址为必填");
      if (licenseError) return jsonFail(licenseError);
      const created = await prisma.user.create({
        data: {
          username,
          passwordHash,
          role: UserRole.CARRIER_MAIN,
          status: UserStatus.ACTIVE,
          carrierKind: "COMPANY",
          displayName: companyName,
          phone: contactPhone,
          carrierProfile: {
            create: {
              companyName,
              address,
              licenseNo: String(body.licenseNo),
              contactName,
              contactPhone,
            },
          },
        },
      });
      await logOp(user!.id, "ADMIN_CREATE_CARRIER", "user", created.id, "管理员建档，免审核");
      return jsonOk({ id: created.id, status: created.status });
    }
    const photos = Array.isArray(body.photoUrls) ? body.photoUrls.map(String).filter(Boolean) : [];
    if (photos.length < 6 || photos.some((photo: string) => !photo.startsWith("data:image/") || photo.length > 250_000)) {
      return jsonFail("请上传 6 张车辆照片");
    }
    const docError =
      imageValue(body.idNumber, "身份证") ||
      imageValue(body.driverLicense, "驾驶证") ||
      imageValue(body.vehicleLicense, "行驶证") ||
      imageValue(body.insuranceNote, "保险证明");
    if (docError) return jsonFail(docError);
    const created = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: UserRole.CARRIER_MAIN,
        status: UserStatus.ACTIVE,
        carrierKind: "PERSONAL",
        displayName: contactName,
        phone: contactPhone,
        carrierProfile: {
          create: {
            contactName,
            contactPhone,
            idNumber: String(body.idNumber),
            driverLicense: String(body.driverLicense),
            vehicleLicense: String(body.vehicleLicense),
            insuranceNote: String(body.insuranceNote),
            photoUrls: JSON.stringify(photos.slice(0, 6)),
          },
        },
      },
    });
    await logOp(user!.id, "ADMIN_CREATE_CARRIER", "user", created.id, "管理员建档，免审核");
    return jsonOk({ id: created.id, status: created.status });
  }
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
