import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp } from "@/lib/market";

function imageValue(value: unknown, label: string): { error?: string; text: string } {
  const text = String(value || "");
  if (!text.startsWith("data:image/")) return { error: `请上传${label}`, text: "" };
  if (text.length > 250_000) return { error: `${label}图片过大，请换一张较小的照片`, text: "" };
  return { text };
}

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
    if (photos.length < 6 || photos.some((p: string) => !p.startsWith("data:image/") || p.length > 250_000)) {
      return jsonFail("请上传 6 张车辆照片");
    }
    const idCard = imageValue(body.idNumber, "身份证");
    const driverLicense = imageValue(body.driverLicense, "驾驶证");
    const vehicleLicense = imageValue(body.vehicleLicense, "行驶证");
    const insurance = imageValue(body.insuranceNote, "保险证明");
    const docError = idCard.error || driverLicense.error || vehicleLicense.error || insurance.error;
    if (docError) return jsonFail(docError);
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
            idNumber: idCard.text,
            driverLicense: driverLicense.text,
            vehicleLicense: vehicleLicense.text,
            insuranceNote: insurance.text,
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
  const license = imageValue(body.licenseNo, "营业执照");
  if (!companyName || !address) return jsonFail("公司名称、地址为必填");
  if (license.error) return jsonFail(license.error);
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
          licenseNo: license.text,
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
