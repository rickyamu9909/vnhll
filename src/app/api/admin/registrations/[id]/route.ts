import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { logOp } from "@/lib/market";

type Ctx = { params: { id: string } };

function photosOf(raw?: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function detailOf(row: {
  id: string;
  username: string;
  displayName: string | null;
  phone: string | null;
  role: string;
  carrierKind: string | null;
  status: string;
  rejectReason: string | null;
  company: {
    companyName: string;
    taxCode: string | null;
    contactName: string | null;
    contactPhone: string | null;
    address: string | null;
    licenseImage: string | null;
  } | null;
  carrierProfile: {
    companyName: string | null;
    address: string | null;
    licenseNo: string | null;
    contactName: string | null;
    contactPhone: string | null;
    idNumber: string | null;
    driverLicense: string | null;
    vehicleLicense: string | null;
    insuranceNote: string | null;
    photoUrls: string | null;
  } | null;
  vehicles?: Array<{ id: string; plateNumber: string; vehicleType: string; loadTons: number }>;
}) {
  const profile = row.carrierProfile;
  const company = row.company;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    phone: row.phone || company?.contactPhone || profile?.contactPhone || null,
    role: row.role,
    carrierKind: row.carrierKind,
    status: row.status,
    rejectReason: row.rejectReason,
    companyName: company?.companyName || profile?.companyName || null,
    taxCode: company?.taxCode || null,
    address: company?.address || profile?.address || null,
    contactName: company?.contactName || profile?.contactName || null,
    contactPhone: company?.contactPhone || profile?.contactPhone || row.phone || null,
    licenseNo: profile?.licenseNo || company?.licenseImage || null,
    licenseImage: company?.licenseImage || null,
    idNumber: profile?.idNumber || null,
    driverLicense: profile?.driverLicense || null,
    vehicleLicense: profile?.vehicleLicense || null,
    insuranceNote: profile?.insuranceNote || null,
    photos: photosOf(profile?.photoUrls),
    vehicles: (row.vehicles || []).map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      loadTons: v.loadTons,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const row = await prisma.user.findUnique({
    where: { id: params.id },
    include: { company: true, carrierProfile: true, vehicles: true },
  });
  if (!row) return jsonFail("用户不存在", 404);
  return jsonOk(detailOf(row));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireAdmin(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { company: true, carrierProfile: true },
  });
  if (!target || target.role === UserRole.ADMIN) return jsonFail("用户不存在", 404);

  const companyName = String(body.companyName ?? "").trim();
  const contactName = String(body.contactName ?? "").trim();
  const contactPhone = String(body.contactPhone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const taxCode = String(body.taxCode ?? "").trim();
  const displayName =
    String(body.displayName || "").trim() || companyName || contactName || target.displayName || target.username;
  const phone = contactPhone || target.phone || null;

  await prisma.user.update({
    where: { id: params.id },
    data: {
      displayName: displayName || target.displayName,
      phone: phone || null,
    },
  });

  if (target.role === UserRole.CUSTOMER) {
    const licenseImage = body.licenseImage != null ? String(body.licenseImage || "") || null : undefined;
    await prisma.company.upsert({
      where: { userId: params.id },
      create: {
        userId: params.id,
        companyName: companyName || displayName || target.username,
        taxCode: taxCode || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        address: address || null,
        licenseImage: licenseImage ?? null,
      },
      update: {
        ...(companyName ? { companyName } : {}),
        taxCode: taxCode || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        address: address || null,
        ...(licenseImage !== undefined ? { licenseImage } : {}),
      },
    });
  } else {
    const licenseNo = body.licenseNo != null ? String(body.licenseNo || "") || null : undefined;
    const idNumber = body.idNumber != null ? String(body.idNumber || "") || null : undefined;
    const driverLicense = body.driverLicense != null ? String(body.driverLicense || "") || null : undefined;
    const vehicleLicense = body.vehicleLicense != null ? String(body.vehicleLicense || "") || null : undefined;
    const insuranceNote = body.insuranceNote != null ? String(body.insuranceNote || "") || null : undefined;
    const photos = Array.isArray(body.photos) ? body.photos.map(String).filter(Boolean) : undefined;
    await prisma.carrierProfile.upsert({
      where: { userId: params.id },
      create: {
        userId: params.id,
        companyName: companyName || null,
        address: address || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        licenseNo: licenseNo ?? null,
        idNumber: idNumber ?? null,
        driverLicense: driverLicense ?? null,
        vehicleLicense: vehicleLicense ?? null,
        insuranceNote: insuranceNote ?? null,
        photoUrls: photos ? JSON.stringify(photos.slice(0, 6)) : null,
      },
      update: {
        companyName: companyName || null,
        address: address || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        ...(licenseNo !== undefined ? { licenseNo } : {}),
        ...(idNumber !== undefined ? { idNumber } : {}),
        ...(driverLicense !== undefined ? { driverLicense } : {}),
        ...(vehicleLicense !== undefined ? { vehicleLicense } : {}),
        ...(insuranceNote !== undefined ? { insuranceNote } : {}),
        ...(photos ? { photoUrls: JSON.stringify(photos.slice(0, 6)) } : {}),
      },
    });
  }

  await logOp(user!.id, "REGISTER_UPDATE", "user", params.id);
  const row = await prisma.user.findUnique({
    where: { id: params.id },
    include: { company: true, carrierProfile: true, vehicles: true },
  });
  return jsonOk(detailOf(row!));
}
