import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp } from "@/lib/market";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kind = String(body.kind || "COMPANY");
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const contactPhone = String(body.contactPhone || "").trim();
  if (!username || !password || password.length < 6 || !contactPhone) {
    return jsonFail("账号、密码、联系电话为必填");
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return jsonFail("账号已存在");

  const passwordHash = await bcrypt.hash(password, 10);
  if (kind === "PERSONAL") {
    const photos = Array.isArray(body.photoUrls) ? body.photoUrls.map(String).filter(Boolean) : [];
    if (photos.length < 6) return jsonFail("个人司机需提供 6 张车辆照片（可填图片地址）");
    if (!body.idNumber || !body.driverLicense || !body.vehicleLicense || !body.insuranceNote) {
      return jsonFail("身份证、驾驶证、行驶证、保险证明为必填");
    }
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: UserRole.CARRIER_MAIN,
        status: UserStatus.PENDING,
        carrierKind: "PERSONAL",
        displayName: String(body.contactName || username),
        phone: contactPhone,
        carrierProfile: {
          create: {
            contactName: String(body.contactName || ""),
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
    await logOp(user.id, "REGISTER_PERSONAL", "user", user.id);
    return jsonOk({ id: user.id, status: user.status });
  }

  const companyName = String(body.companyName || "").trim();
  const address = String(body.address || "").trim();
  const licenseNo = String(body.licenseNo || "").trim();
  if (!companyName || !address || !licenseNo) return jsonFail("公司名称、地址、营业执照为必填");
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: UserRole.CARRIER_MAIN,
      status: UserStatus.PENDING,
      carrierKind: "COMPANY",
      displayName: companyName,
      phone: contactPhone,
      carrierProfile: {
        create: {
          companyName,
          address,
          licenseNo,
          contactName: String(body.contactName || ""),
          contactPhone,
        },
      },
    },
  });
  if (body.plateNumber && body.vehicleType) {
    await prisma.vehicle.create({
      data: {
        ownerUserId: user.id,
        plateNumber: String(body.plateNumber),
        vehicleType: body.vehicleType as VehicleType,
        loadTons: Number(body.loadTons || 1),
      },
    });
  }
  await logOp(user.id, "REGISTER_COMPANY", "user", user.id);
  return jsonOk({ id: user.id, status: user.status });
}
